import type { OrderStatus } from "@/generated/prisma/enums";
import { generateCode } from "@/lib/codes";

/** Estados en los que el cliente todavía espera respuesta del comercio. */
export const WAITING_STATUSES: readonly OrderStatus[] = ["PENDING", "SENT_TO_STORE"];

/** Transiciones permitidas de la máquina de estados del pedido. */
const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PENDING: ["SENT_TO_STORE", "CANCELLED"],
  SENT_TO_STORE: ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"],
  ACCEPTED: ["CANCELLED"],
  REJECTED: [],
  EXPIRED: ["CANCELLED"],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return TRANSITIONS[from].includes(to);
}

/** Estados en los que una respuesta del comercio llega tarde y hay que avisarle que no la prepare. */
export type LateReplyState = "EXPIRED" | "CANCELLED";

/**
 * Si el comercio responde y el pedido ya no está en SENT_TO_STORE: en EXPIRED o CANCELLED
 * se le avisa (y al dueño); en ACCEPTED/REJECTED es una doble pulsación y se ignora.
 */
export function lateReplyState(status: OrderStatus): LateReplyState | null {
  return status === "EXPIRED" || status === "CANCELLED" ? status : null;
}

/**
 * El cliente cancela al instante mientras el comercio no haya aceptado: recibido, esperando
 * al comercio o sin respuesta. Una vez aceptado, solo puede pedirlo desde Ayuda.
 */
export function customerCanCancelNow(status: OrderStatus) {
  return status === "PENDING" || status === "SENT_TO_STORE" || status === "EXPIRED";
}

/** Pedido aceptado (en preparación): la cancelación se solicita y la decide Dfly. */
export function customerCanRequestCancel(status: OrderStatus) {
  return status === "ACCEPTED";
}

export type PricedLine = { unitPriceCents: number; quantity: number };

export function computeTotals(lines: PricedLine[], deliveryFeeCents: number) {
  const subtotalCents = lines.reduce((sum, l) => sum + l.unitPriceCents * l.quantity, 0);
  return { subtotalCents, deliveryFeeCents, totalCents: subtotalCents + deliveryFeeCents };
}

/** Código corto del pedido que ve el cliente y se dicta por teléfono. */
export function generatePublicCode() {
  return generateCode(5);
}

/** Costo de envío fijo (centavos de USD): $2.00 por defecto, configurable por entorno. */
export function deliveryFeeCents() {
  const raw = Number(process.env.DELIVERY_FEE_CENTS ?? "200");
  return Number.isInteger(raw) && raw >= 0 ? raw : 200;
}
