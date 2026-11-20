import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import type { OutboxKind } from "@/generated/prisma/enums";
import { messageParts, type OutgoingMessage } from "./messages";
import { getTransport } from "./transport";

const MAX_ATTEMPTS = 5;
/** Tiempo que un envío queda "reservado" para que dos procesos no lo manden a la vez. */
const LEASE_MS = 60_000;

export function adminPhone() {
  const phone = process.env.ADMIN_WHATSAPP_TO;
  if (!phone) throw new Error("ADMIN_WHATSAPP_TO no está configurado");
  return phone;
}

/** Guarda el mensaje dentro de la misma transacción que el cambio del pedido (patrón outbox). */
export function enqueue(
  tx: Prisma.TransactionClient,
  orderId: string,
  kind: OutboxKind,
  to: string,
  message: OutgoingMessage,
) {
  return tx.outboxMessage.create({
    data: { orderId, kind, to, payload: message as unknown as Prisma.InputJsonValue },
    select: { id: true },
  });
}

function backoffMs(attempt: number) {
  return 2 ** (attempt - 1) * 60_000; // 1, 2, 4, 8 min
}

export type SentMessage = { kind: OutboxKind; orderId: string };

/**
 * Lo que debe pasar en el dominio cuando un mensaje sale (p. ej. el pedido pasa a SENT_TO_STORE).
 * Corre en la MISMA transacción que lo marca como SENT. Lo aporta quien despacha (`ordering/dispatch.ts`):
 * este módulo es infraestructura y no conoce las reglas del pedido.
 */
export type OnSent = (tx: Prisma.TransactionClient, message: SentMessage) => Promise<void>;

/**
 * Envía los mensajes pendientes. Seguro de ejecutar en paralelo (after() + cron).
 * `onSent` es obligatorio para que nadie despache sin aplicar sus efectos en el pedido.
 */
export async function dispatchOutbox({ orderId, limit = 25, onSent }: { orderId?: string; limit?: number; onSent: OnSent }) {
  const now = new Date();
  const due = await prisma.outboxMessage.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now }, ...(orderId ? { orderId } : {}) },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, kind: true, orderId: true, to: true, payload: true, attempts: true, partsSent: true },
  });

  const transport = getTransport();
  let sent = 0;
  let failed = 0;

  for (const msg of due) {
    // Reserva optimista: si otro proceso ya lo tomó, `attempts` no coincide y se salta.
    const claim = await prisma.outboxMessage.updateMany({
      where: { id: msg.id, status: "PENDING", attempts: msg.attempts },
      data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + LEASE_MS) },
    });
    if (claim.count === 0) continue;
    const attempt = msg.attempts + 1;

    try {
      // Un pedido largo son varios mensajes: se retoma desde el primero que no salió.
      const parts = messageParts(msg.payload as unknown as OutgoingMessage);
      if (msg.partsSent >= parts.length) {
        // Ya salieron todas (no debería quedar PENDING): se cierra para que no se reclame para siempre.
        await prisma.outboxMessage.update({ where: { id: msg.id }, data: { status: "SENT", lastError: null } });
        sent++;
        continue;
      }
      for (let i = msg.partsSent; i < parts.length; i++) {
        const { id } = await transport.send(msg.to, parts[i]);
        const last = i === parts.length - 1;
        const status = await prisma.$transaction(async (tx) => {
          const row = await tx.outboxMessage.update({
            where: { id: msg.id },
            data: {
              partsSent: i + 1,
              // Se guarda el id del primero, el que lleva los botones si los hay.
              ...(i === 0 ? { waMessageId: id } : {}),
              // Sin cambiar el estado si se canceló mientras salía: `onSent` decide qué avisar.
              ...(last ? { status: "SENT", lastError: null } : { nextAttemptAt: new Date(Date.now() + LEASE_MS) }),
            },
            select: { status: true },
          });
          // El efecto en el pedido ocurre con el primer mensaje: desde ahí el comercio ya puede responder.
          if (i === 0) await onSent(tx, { kind: msg.kind, orderId: msg.orderId });
          return row.status;
        });
        // Cancelado (SKIPPED) entre partes: no se envía el resto.
        if (!last && status !== "PENDING") break;
        if (last) sent++;
      }
    } catch (error) {
      failed++;
      const lastError = error instanceof Error ? error.message.slice(0, 500) : "Error desconocido";
      await prisma.outboxMessage.update({
        where: { id: msg.id },
        data:
          attempt >= MAX_ATTEMPTS
            ? { status: "FAILED", lastError }
            : { lastError, nextAttemptAt: new Date(Date.now() + backoffMs(attempt)) },
      });
      console.error(`[outbox] ${msg.kind} del pedido ${msg.orderId} falló (intento ${attempt}): ${lastError}`);
    }
  }

  return { processed: due.length, sent, failed };
}
