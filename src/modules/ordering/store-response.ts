import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import type { StoreAction } from "@/modules/messaging/action-payload";
import {
  adminExpiredMessage,
  adminLateResponseMessage,
  adminResultMessage,
  customerResultMessage,
  storeLateResponseMessage,
} from "@/modules/messaging/messages";
import { adminPhone, enqueue } from "@/modules/messaging/outbox";
import { lateReplyState, storeReplyMustRetry } from "./domain";
import { transitionOrder } from "./transitions";

const digits = (phone: string) => phone.replace(/\D/g, "");

/**
 * El comercio respondió antes de que quedara registrado el envío de su pedido (sigue en PENDING).
 * Se lanza para revertir la transacción (sin dejar el WebhookEvent) y que el webhook responda 500:
 * Meta reintenta la pulsación y, para entonces, el outbox ya habrá pasado el pedido a SENT_TO_STORE.
 */
export class StoreReplyTooEarlyError extends Error {
  constructor(readonly orderId: string) {
    super(`El pedido ${orderId} aún no figura como enviado al comercio`);
    this.name = "StoreReplyTooEarlyError";
  }
}

export type StoreResponseResult =
  | "applied"
  | "already-answered"
  | "late-noticed"
  | "duplicate"
  | "not-found"
  | "wrong-sender";

/**
 * Aplica el Aceptar/Rechazar del comercio y encola los avisos al dueño y al cliente.
 * `waMessageId` se registra en la misma transacción: si algo falla no queda marcado y el reintento de Meta vuelve a aplicarlo.
 */
export async function applyStoreResponse(
  orderId: string,
  action: StoreAction,
  fromPhone: string,
  waMessageId: string,
): Promise<StoreResponseResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      publicCode: true,
      customerName: true,
      customerPhone: true,
      store: { select: { name: true, whatsappPhone: true } },
    },
  });
  if (!order) return "not-found";
  // Solo el número registrado del comercio puede responder por ese pedido.
  if (digits(order.store.whatsappPhone) !== digits(fromPhone)) return "wrong-sender";

  const accepted = action === "accept";
  const ownerPhone = adminPhone();
  try {
    return await prisma.$transaction(async (tx) => {
      // Idempotencia: Meta puede reenviar el mismo evento.
      await tx.webhookEvent.create({ data: { waMessageId } });
      const changed = await transitionOrder(tx, orderId, "SENT_TO_STORE", accepted ? "ACCEPTED" : "REJECTED", "STORE", {
        respondedAt: new Date(),
      });
      if (!changed) {
        // Respuesta tardía: se relee el estado dentro de la transacción (la lectura previa puede estar desfasada).
        const current = await tx.order.findUnique({ where: { id: orderId }, select: { status: true } });
        if (current && storeReplyMustRetry(current.status)) throw new StoreReplyTooEarlyError(orderId);
        const lateState = current ? lateReplyState(current.status) : null;
        if (!lateState) return "already-answered";
        // Un solo aviso de cada tipo por pedido aunque el comercio pulse varias veces (cada pulsación trae otro
        // waMessageId). Al expirar, el cron ya avisó al comercio; entonces solo falta avisar al dueño.
        const [storeNoticed, adminNoticed] = await Promise.all([
          tx.outboxMessage.count({ where: { orderId, kind: "STORE_LATE_RESPONSE" } }),
          tx.outboxMessage.count({ where: { orderId, kind: "ADMIN_LATE_RESPONSE" } }),
        ]);
        if (storeNoticed > 0 && adminNoticed > 0) return "already-answered";
        if (storeNoticed === 0) {
          await enqueue(
            tx,
            orderId,
            "STORE_LATE_RESPONSE",
            order.store.whatsappPhone,
            storeLateResponseMessage({ publicCode: order.publicCode, storeName: order.store.name }, lateState),
          );
        }
        if (adminNoticed === 0) {
          await enqueue(
            tx,
            orderId,
            "ADMIN_LATE_RESPONSE",
            ownerPhone,
            adminLateResponseMessage(order.publicCode, order.store.name, accepted, lateState),
          );
        }
        return "late-noticed";
      }

      const firstName = order.customerName.split(/\s+/)[0] ?? order.customerName;
      await enqueue(tx, orderId, "ADMIN_RESULT", ownerPhone, adminResultMessage(order.publicCode, order.store.name, accepted));
      await enqueue(
        tx,
        orderId,
        "CUSTOMER_RESULT",
        order.customerPhone,
        customerResultMessage(order.publicCode, firstName, order.store.name, accepted),
      );
      return "applied";
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "duplicate";
    throw error;
  }
}

export function responseTimeoutMinutes() {
  const n = Number(process.env.ORDER_RESPONSE_TIMEOUT_MIN ?? "5");
  return Number.isFinite(n) && n > 0 ? n : 5;
}

/**
 * Marca como EXPIRED los pedidos sin respuesta, avisa al dueño para que llame al comercio
 * y al comercio para que no lo prepare (en la misma transacción).
 */
export async function expireStaleOrders() {
  const minutes = responseTimeoutMinutes();
  const cutoff = new Date(Date.now() - minutes * 60_000);
  const stale = await prisma.order.findMany({
    where: { status: "SENT_TO_STORE", updatedAt: { lte: cutoff } },
    select: { id: true, publicCode: true, store: { select: { name: true, whatsappPhone: true } } },
    take: 50,
  });

  let expired = 0;
  for (const order of stale) {
    const changed = await prisma.$transaction(async (tx) => {
      const ok = await transitionOrder(tx, order.id, "SENT_TO_STORE", "EXPIRED", "SYSTEM");
      if (ok) {
        await enqueue(tx, order.id, "ADMIN_EXPIRED", adminPhone(), adminExpiredMessage(order.publicCode, order.store.name, minutes));
        await enqueue(
          tx,
          order.id,
          "STORE_LATE_RESPONSE",
          order.store.whatsappPhone,
          storeLateResponseMessage({ publicCode: order.publicCode, storeName: order.store.name }, "EXPIRED"),
        );
      }
      return ok;
    });
    if (changed) expired++;
  }
  return { expired };
}
