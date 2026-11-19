import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import {
  adminCustomerCancelledMessage,
  customerCancelledMessage,
  storeCancelledMessage,
} from "@/modules/messaging/messages";
import { adminPhone, enqueue } from "@/modules/messaging/outbox";
import { canTransition, customerCanCancelNow, customerCanRequestCancel } from "./domain";
import { transitionOrder } from "./transitions";

const cancelSelect = {
  id: true,
  status: true,
  publicCode: true,
  customerName: true,
  customerPhone: true,
  store: { select: { name: true, whatsappPhone: true } },
} satisfies Prisma.OrderSelect;

type CancellableOrder = Prisma.OrderGetPayload<{ select: typeof cancelSelect }>;

/**
 * Cancela en una transacción y encola los avisos:
 * - El pedido al comercio que siga en cola se marca SKIPPED (no sale).
 * - Si el comercio ya lo recibió, se le avisa que no lo prepare (salvo que ya se le haya dicho).
 * - Si cancela Dfly, se avisa al cliente; si cancela el cliente, se avisa al dueño.
 * - Una solicitud de cancelación pendiente queda aprobada.
 * Devuelve false si el pedido cambió de estado mientras tanto (gana la primera respuesta).
 */
async function applyCancellation(
  tx: Prisma.TransactionClient,
  order: CancellableOrder,
  actor: "ADMIN" | "CUSTOMER",
): Promise<boolean> {
  const changed = await transitionOrder(tx, order.id, order.status, "CANCELLED", actor);
  if (!changed) return false;

  await tx.outboxMessage.updateMany({
    where: { orderId: order.id, kind: "STORE_REQUEST", status: { in: ["PENDING", "FAILED"] } },
    data: { status: "SKIPPED", lastError: "Pedido cancelado antes de enviarse" },
  });
  const [storeWasContacted, storeAlreadyTold] = await Promise.all([
    tx.outboxMessage.count({ where: { orderId: order.id, kind: "STORE_REQUEST", status: "SENT" } }),
    // Al vencer, el comercio ya recibió "no lo prepares".
    tx.outboxMessage.count({ where: { orderId: order.id, kind: { in: ["STORE_CANCELLED", "STORE_LATE_RESPONSE"] } } }),
  ]);
  if (storeWasContacted > 0 && storeAlreadyTold === 0) {
    await enqueue(
      tx,
      order.id,
      "STORE_CANCELLED",
      order.store.whatsappPhone,
      storeCancelledMessage({ publicCode: order.publicCode, storeName: order.store.name }),
    );
  }

  if (actor === "ADMIN") {
    const firstName = order.customerName.split(/\s+/)[0] ?? order.customerName;
    await enqueue(
      tx,
      order.id,
      "CUSTOMER_CANCELLED",
      order.customerPhone,
      customerCancelledMessage(order.publicCode, firstName, order.store.name),
    );
  } else {
    await enqueue(
      tx,
      order.id,
      "ADMIN_CUSTOMER_CANCELLED",
      adminPhone(),
      adminCustomerCancelledMessage(order.publicCode, order.store.name),
    );
  }

  await tx.cancellationRequest.updateMany({
    where: { orderId: order.id, status: "PENDING" },
    data: { status: "APPROVED", resolvedAt: new Date() },
  });
  return true;
}

export type AdminCancelResult = "cancelled" | "not-found" | "not-cancellable" | "changed-meanwhile";

/** Cancela desde el panel (también aprueba una solicitud del cliente). Avisa al cliente y, si aplica, al comercio. */
export async function cancelOrderByAdmin(orderId: string): Promise<AdminCancelResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, select: cancelSelect });
  if (!order) return "not-found";
  if (!canTransition(order.status, "CANCELLED")) return "not-cancellable";
  const ok = await prisma.$transaction((tx) => applyCancellation(tx, order, "ADMIN"));
  return ok ? "cancelled" : "changed-meanwhile";
}

export type CustomerCancelResult =
  | { result: "cancelled"; orderId: string }
  | { result: "not-found" }
  /** El comercio ya aceptó: hay que solicitarlo desde Ayuda. */
  | { result: "needs-request"; status: OrderStatus }
  | { result: "not-cancellable"; status: OrderStatus };

/**
 * El cliente cancela su pedido al instante, solo si el comercio aún no lo aceptó.
 * La propiedad se comprueba en la consulta (publicCode + userId).
 */
export async function cancelOrderByCustomer(publicCode: string, userId: string): Promise<CustomerCancelResult> {
  const order = await prisma.order.findFirst({ where: { publicCode, userId }, select: cancelSelect });
  if (!order) return { result: "not-found" };
  if (!customerCanCancelNow(order.status)) {
    return customerCanRequestCancel(order.status)
      ? { result: "needs-request", status: order.status }
      : { result: "not-cancellable", status: order.status };
  }

  const ok = await prisma.$transaction((tx) => applyCancellation(tx, order, "CUSTOMER"));
  if (ok) return { result: "cancelled", orderId: order.id };

  // Cambió mientras tanto (p. ej. el comercio aceptó justo ahora): se informa el estado real.
  const current = await prisma.order.findUniqueOrThrow({ where: { id: order.id }, select: { status: true } });
  return customerCanRequestCancel(current.status)
    ? { result: "needs-request", status: current.status }
    : { result: "not-cancellable", status: current.status };
}
