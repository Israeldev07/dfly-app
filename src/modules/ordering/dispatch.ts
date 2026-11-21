import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { storeCancelledMessage } from "@/modules/messaging/messages";
import { dispatchOutbox, enqueue, type OnSent } from "@/modules/messaging/outbox";
import { storeNoticeRecipient } from "./store-contact";
import { transitionOrder } from "./transitions";

/** Efectos en el pedido cuando sale un mensaje. Corre en la transacción que lo marca SENT. */
const afterOrderMessageSent: OnSent = async (tx, { kind, orderId }) => {
  if (kind !== "STORE_REQUEST") return;
  const moved = await transitionOrder(tx, orderId, "PENDING", "SENT_TO_STORE", "SYSTEM");
  if (!moved) await noticeStoreIfCancelledInFlight(tx, orderId);
};

/**
 * Única forma de despachar los mensajes de pedidos (checkout, webhook, crons, admin):
 * envía lo pendiente del outbox y aplica sus efectos en el pedido.
 */
export function dispatchOrderMessages(options: { orderId?: string; limit?: number } = {}) {
  return dispatchOutbox({ ...options, onSent: afterOrderMessageSent });
}

/**
 * El admin canceló mientras el pedido al comercio ya estaba saliendo: el comercio lo recibió
 * igual, así que se le avisa que no lo prepare (una sola vez).
 */
async function noticeStoreIfCancelledInFlight(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: { status: true, publicCode: true, store: { select: { name: true, whatsappPhone: true } } },
  });
  if (order?.status !== "CANCELLED") return;
  const already = await tx.outboxMessage.count({ where: { orderId, kind: "STORE_CANCELLED" } });
  if (already > 0) return;
  await enqueue(
    tx,
    orderId,
    "STORE_CANCELLED",
    await storeNoticeRecipient(tx, orderId, order.store.whatsappPhone),
    storeCancelledMessage({ publicCode: order.publicCode, storeName: order.store.name }),
  );
}
