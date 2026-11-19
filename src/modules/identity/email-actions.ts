"use server";

import { auth } from "@/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { retryAfterLabel } from "@/lib/rate-limit-rules";
import { normalizeEmailCode } from "./email-code";
import { sendEmailCode, verifyEmailCode } from "./email-verification";
import { SESSION_EXPIRED } from "./form-errors";

export type EmailVerificationState = {
  error?: string;
  /** Se envió un código y el usuario debe escribirlo. */
  sent?: boolean;
  verified?: boolean;
};

/** Envía (o reenvía) el código de 6 dígitos al email de la cuenta. */
export async function sendEmailCodeAction(): Promise<EmailVerificationState> {
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

export async function verifyEmailCodeAction(
  _prev: EmailVerificationState,
  formData: FormData,
): Promise<EmailVerificationState> {
  const session = await auth();
  if (!session?.user?.id) return { error: SESSION_EXPIRED };

  const code = normalizeEmailCode(String(formData.get("code") ?? ""));
  if (!code) return { sent: true, error: "Escribe los 6 dígitos del código." };

  const result = await verifyEmailCode(session.user.id, code);
  if (result.ok) return { verified: true };
  if (result.reason === "expired") return { error: "El código venció o se usaron todos los intentos. Pide uno nuevo." };
  return {
    sent: true,
    error: `El código no coincide. Te ${result.attemptsLeft === 1 ? "queda 1 intento" : `quedan ${result.attemptsLeft} intentos`}.`,
  };
}
