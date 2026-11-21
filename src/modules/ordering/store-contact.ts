import "server-only";
import type { Prisma } from "@/generated/prisma/client";

/**
 * A qué número del comercio se habla en cada pedido.
 *
 * El número del comercio puede cambiar en el panel con pedidos en curso. La fuente de verdad de cada
 * pedido es el `to` de su STORE_REQUEST (el outbox lo reescribe al enviar con el número real de salida):
 * quien recibió el pedido es quien puede responder y quien debe recibir "no lo prepares".
 */

type Db = Prisma.TransactionClient;

/** Números a los que se envió (o se está enviando) el pedido con los botones. */
export async function storeRequestRecipients(db: Db, orderId: string) {
  const rows = await db.outboxMessage.findMany({
    where: { orderId, kind: "STORE_REQUEST" },
    select: { to: true },
  });
  return rows.map((r) => r.to);
}

/**
 * Número al que mandar un aviso al comercio sobre un pedido: el que recibió el pedido (salió entero o
 * al menos su primer mensaje). Si no consta ninguno, el número actual del comercio.
 */
export async function storeNoticeRecipient(db: Db, orderId: string, currentStorePhone: string) {
  const delivered = await db.outboxMessage.findFirst({
    where: { orderId, kind: "STORE_REQUEST", OR: [{ status: "SENT" }, { partsSent: { gt: 0 } }] },
    orderBy: { createdAt: "desc" },
    select: { to: true },
  });
  return delivered?.to ?? currentStorePhone;
}

/**
 * Al cambiar el número del comercio, los pedidos que aún no le salieron (en cola o fallidos, sin
 * ninguna parte enviada) se redirigen al número nuevo, así "Reintentar" ya no va al número viejo.
 * Si el outbox justo lo está enviando, al terminar vuelve a escribir el `to` real de salida.
 */
export function redirectUnsentStoreRequests(tx: Db, storeId: string, newPhone: string) {
  return tx.outboxMessage.updateMany({
    where: {
      kind: "STORE_REQUEST",
      status: { in: ["PENDING", "FAILED"] },
      partsSent: 0,
      order: { storeId, status: "PENDING" },
    },
    data: { to: newPhone },
  });
}
