"use server";

import bcrypt from "bcryptjs";
import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/db";
import { consumeRateLimit, peekRateLimit } from "@/lib/rate-limit";
import { clientIp, RATE_LIMITED_CODE, retryAfterLabel } from "@/lib/rate-limit-rules";
import { safeCallbackUrl } from "@/lib/safe-callback";
import { loginSchema, phoneSchema, profileSchema, registerSchema } from "@/lib/validations/auth";
import { normalizeEmailCode } from "./email-code";
import { sendEmailCode, verifyEmailCode } from "./email-verification";
import { verificationLink, verificationText } from "./phone-code";
import {
  allowPhoneSimulation,
  phoneVerificationStatus,
  startPhoneVerification,
  verifyPhoneFromMessage,
} from "./phone-verification";

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const parsed = loginSchema.safeParse(raw);
  const values = { email: raw.email ?? "" };
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }

  try {
    await signIn("credentials", { ...parsed.data, redirectTo: redirectTarget(formData) });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === RATE_LIMITED_CODE) {
      const wait = await loginRetryAfterSec(parsed.data.email);
      return { error: `Demasiados intentos. Vuelve a intentarlo en ${retryAfterLabel(wait)}.`, values };
    }
    if (error instanceof AuthError) {
      return { error: "El correo o la contraseña no coinciden.", values };
    }
    throw error; // redirect de éxito
  }
  return {};
}

export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { name: raw.name ?? "", email: raw.email ?? "", phone: raw.phone ?? "", whatsappOptIn: raw.whatsappOptIn ?? "" };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }
  const { name, email, phone, password } = parsed.data;

  // Antes de consultar el email, para que tampoco sirva para enumerar cuentas.
  const limit = await consumeRateLimit("register:ip", clientIp(await headers()));
  if (!limit.ok) {
    return { error: `Demasiados registros desde esta conexión. Inténtalo en ${retryAfterLabel(limit.retryAfterSec)}.`, values };
  }

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return {
      fieldErrors: { email: "Ya existe una cuenta con este correo. Inicia sesión." },
      values,
    };
  }

  await prisma.user.create({
    data: {
      name,
      email,
      phone,
      password: await bcrypt.hash(password, 12),
      whatsappOptInAt: new Date(),
    },
    select: { id: true },
  });

  try {
    await signIn("credentials", { email, password, redirectTo: redirectTarget(formData) });
  } catch (error) {
    // La cuenta ya existe; si el login automático falla (p. ej. rate limit), que entre a mano.
    if (error instanceof AuthError) redirect("/login");
    throw error; // redirect de éxito
  }
  return {};
}

export async function googleSignInAction(formData: FormData) {
  await signIn("google", { redirectTo: redirectTarget(formData) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** La espera que ve el usuario es la del bloqueo más largo (por IP o por email). */
async function loginRetryAfterSec(email: string) {
  const ip = clientIp(await headers());
  const checks = await Promise.all([peekRateLimit("login:ip", ip), peekRateLimit("login:email", email)]);
  return Math.max(...checks.map((c) => (c.ok ? 0 : c.retryAfterSec)), 60);
}

function redirectTarget(formData: FormData) {
  const raw = formData.get("callbackUrl");
  return safeCallbackUrl(typeof raw === "string" ? raw : undefined) ?? "/comercios";
}

export type ProfileState = { ok?: boolean; fieldErrors?: Partial<Record<string, string>>; values?: Record<string, string> };

export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { fieldErrors: { name: "Tu sesión expiró. Vuelve a iniciar sesión." } };

  const raw = { name: String(formData.get("name") ?? "") };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: raw };

  await prisma.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name },
    select: { id: true },
  });
  return { ok: true, values: raw };
}

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
  if (!session?.user?.id) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

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

export type EmailVerificationState = {
  error?: string;
  /** Se envió un código y el usuario debe escribirlo. */
  sent?: boolean;
  verified?: boolean;
};

/** Envía (o reenvía) el código de 6 dígitos al email de la cuenta. */
export async function sendEmailCodeAction(): Promise<EmailVerificationState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

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
  if (!session?.user?.id) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." };

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

/** Solo desarrollo (sin WhatsApp real): hace lo mismo que el webhook al recibir el código. */
export async function simulatePhoneVerificationAction(code: string): Promise<{ verified: boolean }> {
  if (!allowPhoneSimulation()) return { verified: false };
  const session = await auth();
  if (!session?.user?.id) return { verified: false };
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { phone: true } });
  if (!user?.phone) return { verified: false };
  return { verified: (await verifyPhoneFromMessage(user.phone, verificationText(code))) === "verified" };
}
