"use server";

import { after } from "next/server";
import { refresh } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { cancelOrderByCustomer } from "./cancel";
import { requestCancellation } from "./cancel-requests";
import { dispatchOrderMessages } from "./dispatch";

export type CancelState = {
  ok?: boolean;
  error?: string;
  /** El comercio ya aceptó: el cliente debe solicitar la cancelación desde Ayuda. */
  needsRequest?: boolean;
  fieldErrors?: Partial<Record<string, string>>;
  values?: { reason: string };
};

const codeSchema = z.string().trim().toUpperCase().regex(/^[2-9A-HJKMNP-Z]{4,8}$/);
const reasonSchema = z
  .string()
  .trim()
  .min(10, "Cuéntanos el motivo en al menos 10 caracteres.")
  .max(500, "Máximo 500 caracteres.");

const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a iniciar sesión.";

/** Cancela al instante, solo si el comercio aún no aceptó el pedido. */
export async function cancelMyOrderAction(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const session = await auth();
  if (!session?.user?.id) return { error: SESSION_EXPIRED };
  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { error: "Pedido inválido." };

  const res = await cancelOrderByCustomer(code.data, session.user.id);
  switch (res.result) {
    case "cancelled":
      after(() => dispatchOrderMessages({ orderId: res.orderId }));
      refresh();
      return { ok: true };
    case "needs-request":
      refresh();
      return {
        needsRequest: true,
        error: "El comercio ya aceptó tu pedido, así que no se puede cancelar al instante. Puedes solicitarlo desde Ayuda.",
      };
    case "not-cancellable":
      refresh();
      return { error: "Este pedido ya no se puede cancelar." };
    case "not-found":
      return { error: "No encontramos este pedido." };
  }
}

/** Solicita cancelar un pedido ya aceptado. Lo revisa Dfly. */
export async function requestCancellationAction(_prev: CancelState, formData: FormData): Promise<CancelState> {
  const session = await auth();
  if (!session?.user?.id) return { error: SESSION_EXPIRED };
  const values = { reason: String(formData.get("reason") ?? "") };
  const code = codeSchema.safeParse(formData.get("code"));
  if (!code.success) return { error: "Pedido inválido.", values };
  const reason = reasonSchema.safeParse(values.reason);
  if (!reason.success) return { fieldErrors: { reason: reason.error.issues[0]?.message }, values };

  const res = await requestCancellation(code.data, session.user.id, reason.data);
  switch (res.result) {
    case "requested":
      after(() => dispatchOrderMessages({ orderId: res.orderId }));
      refresh();
      return { ok: true };
    case "already-requested":
      refresh();
      return { error: "Ya enviaste una solicitud para este pedido. Te avisaremos por WhatsApp.", values };
    case "can-cancel-now":
      refresh();
      return { error: "El comercio aún no aceptó tu pedido: puedes cancelarlo al instante desde aquí.", values };
    case "not-cancellable":
      refresh();
      return { error: "Este pedido ya no se puede cancelar.", values };
    case "not-found":
      return { error: "No encontramos este pedido.", values };
  }
}
