"use server";

import { auth } from "@/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { retryAfterLabel } from "@/lib/rate-limit-rules";
import { phoneSchema } from "@/lib/validations/auth";
import { fieldErrorsFrom, SESSION_EXPIRED } from "./form-errors";
import { verificationLink, verificationText } from "./phone-code";
import {
  allowPhoneSimulation,
  phoneVerificationStatus,
  simulatePhoneMessage,
  startPhoneVerification,
} from "./phone-verification";

export type PhoneVerificationState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: { phone: string };
  verified?: boolean;
  /** Código pendiente: el usuario debe enviarlo desde su WhatsApp. */
  pending?: { code: string; text: string; link: string | null; expiresAt: string; phone: string };
};

/** Guarda el celular y devuelve el código y el enlace de WhatsApp para verificarlo. */
export async function startPhoneVerificationAction(
  _prev: PhoneVerificationState,
  formData: FormData,
): Promise<PhoneVerificationState> {
  const session = await auth();
  if (!session?.user?.id) return { error: SESSION_EXPIRED };

  const raw = { phone: String(formData.get("phone") ?? "") };
  const parsed = phoneSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: raw };

  const limit = await consumeRateLimit("phone-code:user", session.user.id);
  if (!limit.ok) {
    return { error: `Pediste varios códigos seguidos. Inténtalo en ${retryAfterLabel(limit.retryAfterSec)}.`, values: raw };
  }

  const result = await startPhoneVerification(session.user.id, parsed.data.phone);
  if (result.verified) return { verified: true, values: raw };

  const dflyNumber = process.env.DFLY_WHATSAPP_NUMBER;
  if (!dflyNumber && process.env.NODE_ENV === "production") {
    console.error("[phone] DFLY_WHATSAPP_NUMBER no configurado");
    return { error: "No pudimos preparar la verificación. Inténtalo más tarde.", values: raw };
  }
  return {
    values: raw,
    pending: {
      code: result.code,
      text: verificationText(result.code),
      link: dflyNumber ? verificationLink(dflyNumber, result.code) : null,
      expiresAt: result.expiresAt.toISOString(),
      phone: parsed.data.phone,
    },
  };
}

/** Lo consulta la página mientras espera el mensaje del usuario. */
export async function phoneVerificationStatusAction(): Promise<{ verified: boolean }> {
  const session = await auth();
  if (!session?.user?.id) return { verified: false };
  return phoneVerificationStatus(session.user.id);
}

/** Solo desarrollo (sin WhatsApp real): hace lo mismo que el webhook al recibir el código. */
export async function simulatePhoneVerificationAction(code: string): Promise<{ verified: boolean }> {
  if (!allowPhoneSimulation()) return { verified: false };
  const session = await auth();
  if (!session?.user?.id) return { verified: false };
  return { verified: await simulatePhoneMessage(session.user.id, code) };
}
