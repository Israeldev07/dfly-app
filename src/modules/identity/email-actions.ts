"use server";

import { auth } from "@/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { retryAfterLabel } from "@/lib/rate-limit-rules";
import { sendEmailCode, verifyEmailCode } from "./email-verification";
import { codeResultState, SESSION_EXPIRED, type CodeState } from "./form-errors";
import { normalizeCode } from "./verification-code";

/** Envía (o reenvía) el código de 6 dígitos al correo de la cuenta. */
export async function sendEmailCodeAction(): Promise<CodeState> {
  const session = await auth();
  if (!session?.user?.id) return { error: SESSION_EXPIRED };

  const limit = await consumeRateLimit("email-code:user", session.user.id);
  if (!limit.ok) {
    return { error: `Ya te enviamos varios códigos. Pide otro en ${retryAfterLabel(limit.retryAfterSec)}.`, sent: true };
  }
  try {
    const result = await sendEmailCode(session.user.id);
    return result === "already-verified" ? { verified: true } : { sent: true };
  } catch (error) {
    console.error("[email] no se pudo enviar el código", error);
    return { error: "No pudimos enviar el código. Inténtalo en unos minutos." };
  }
}

export async function verifyEmailCodeAction(_prev: CodeState, formData: FormData): Promise<CodeState> {
  const session = await auth();
  if (!session?.user?.id) return { error: SESSION_EXPIRED };

  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code) return { sent: true, error: "Escribe los 6 dígitos del código." };

  const result = await verifyEmailCode(session.user.id, code);
  return codeResultState(result);
}
