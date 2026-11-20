"use server";

import { headers } from "next/headers";
import { auth } from "@/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { clientIp, retryAfterLabel } from "@/lib/rate-limit-rules";
import { phoneSchema } from "@/lib/validations/auth";
import { codeResultState, fieldErrorsFrom, SESSION_EXPIRED, type CodeState } from "./form-errors";
import { sendPhoneCode, verifyPhoneCode } from "./phone-verification";
import { normalizeCode } from "./verification-code";

export type PhoneCodeState = CodeState & {
  fieldErrors?: Partial<Record<string, string>>;
  /** Número (E.164) al que se envió el código. */
  phone?: string;
  values?: { phone: string };
};

/** Envía por WhatsApp un código de 6 dígitos al celular indicado. */
export async function sendPhoneCodeAction(_prev: PhoneCodeState, formData: FormData): Promise<PhoneCodeState> {
  const session = await auth();
  if (!session?.user?.id) return { error: SESSION_EXPIRED };

  const raw = { phone: String(formData.get("phone") ?? "") };
  const parsed = phoneSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: raw };
  const { phone } = parsed.data;

  // Cada envío cuesta: se limita por cuenta, por número de destino y por conexión.
  const checks = [
    await consumeRateLimit("phone-code:user", session.user.id),
    await consumeRateLimit("phone-code:phone", phone),
    await consumeRateLimit("phone-code:ip", clientIp(await headers())),
  ];
  const blocked = checks.find((c) => !c.ok);
  if (blocked && !blocked.ok) {
    return { error: `Pediste varios códigos seguidos. Inténtalo en ${retryAfterLabel(blocked.retryAfterSec)}.`, values: raw };
  }

  try {
    const result = await sendPhoneCode(session.user.id, phone);
    if (result.verified) return { verified: true, values: raw };
  } catch (error) {
    console.error("[phone] no se pudo enviar el código por WhatsApp", error);
    return { error: "No pudimos enviarte el código por WhatsApp. Revisa el número o inténtalo en unos minutos.", values: raw };
  }
  return { sent: true, phone, values: raw };
}

export async function verifyPhoneCodeAction(prev: PhoneCodeState, formData: FormData): Promise<PhoneCodeState> {
  const session = await auth();
  if (!session?.user?.id) return { error: SESSION_EXPIRED };

  const code = normalizeCode(String(formData.get("code") ?? ""));
  if (!code) return { ...prev, sent: true, error: "Escribe los 6 dígitos del código." };

  const result = codeResultState(await verifyPhoneCode(session.user.id, code));
  return { ...result, phone: prev.phone, values: prev.values };
}
