import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { adminCancelRequestMessage, customerCancelRejectedMessage } from "@/modules/messaging/messages";
import { adminPhone, enqueue } from "@/modules/messaging/outbox";
import { customerCanCancelNow, customerCanRequestCancel } from "./domain";

export type RequestCancelResult =
  | { result: "requested"; orderId: string }
  | { result: "not-found" }
  /** El comercio todavía no aceptó: se puede cancelar al instante, no hace falta solicitud. */
  | { result: "can-cancel-now" }
  | { result: "already-requested" }
  | { result: "not-cancellable" };

/**
 * El cliente pide cancelar un pedido que el comercio ya aceptó. Se guarda la solicitud y se avisa
 * al dueño en la misma transacción; Dfly la aprueba (cancela) o la rechaza desde el panel.
 */
export async function requestCancellation(publicCode: string, userId: string, reason: string): Promise<RequestCancelResult> {
  const order = await prisma.order.findFirst({
    where: { publicCode, userId },
    select: { id: true, status: true, publicCode: true, customerName: true, store: { select: { name: true } } },
  });
  if (!order) return { result: "not-found" };
  if (customerCanCancelNow(order.status)) return { result: "can-cancel-now" };
  if (!customerCanRequestCancel(order.status)) return { result: "not-cancellable" };

  try {
    await prisma.$transaction(async (tx) => {
      await tx.cancellationRequest.create({ data: { orderId: order.id, userId, reason }, select: { id: true } });
      await enqueue(
        tx,
        order.id,
        "ADMIN_CANCEL_REQUEST",
        adminPhone(),
        adminCancelRequestMessage(order.publicCode, order.store.name, order.customerName, reason),
      );
    });
  } catch (error) {
    // Una solicitud por pedido (orderId @unique).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return { result: "already-requested" };
    throw error;
  }
  return { result: "requested", orderId: order.id };
}

export type RejectRequestResult = "rejected" | "not-found" | "already-resolved";

/** Dfly rechaza la solicitud: el pedido sigue en curso y se avisa al cliente. */
export async function rejectCancellationRequest(orderId: string): Promise<RejectRequestResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { publicCode: true, customerName: true, customerPhone: true, store: { select: { name: true } } },
  });
  if (!order) return "not-found";

  return prisma.$transaction(async (tx) => {
    // Condicionado a PENDING: si dos admins resuelven a la vez, gana el primero.
    const { count } = await tx.cancellationRequest.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "REJECTED", resolvedAt: new Date() },
    });
    if (count === 0) return "already-resolved";
    const firstName = order.customerName.split(/\s+/)[0] ?? order.customerName;
    await enqueue(
      tx,
      orderId,
      "CUSTOMER_CANCEL_REJECTED",
      order.customerPhone,
      customerCancelRejectedMessage(order.publicCode, firstName, order.store.name),
    );
    return "rejected";
  });
}
