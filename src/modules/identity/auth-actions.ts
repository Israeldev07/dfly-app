"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { consumeRateLimit, peekRateLimit } from "@/lib/rate-limit";
import { clientIp, RATE_LIMITED_CODE, retryAfterLabel } from "@/lib/rate-limit-rules";
import { safeCallbackUrl } from "@/lib/safe-callback";
import { loginSchema, registerSchema } from "@/lib/validations/auth";
import { createCredentialsUser } from "./accounts";
import { sendEmailCode } from "./email-verification";
import { fieldErrorsFrom } from "./form-errors";

export type FormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
};

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

  const created = await createCredentialsUser({ name, email, phone, password });
  if (created === "email-taken") {
    return { fieldErrors: { email: "Ya existe una cuenta con este correo. Inicia sesión." }, values };
  }

  // El código del correo sale ya; si falla, la página de verificación permite pedir otro.
  try {
    await sendEmailCode(created.id);
  } catch (error) {
    console.error("[email] no se pudo enviar el código del registro", error);
  }

  // Tras registrarse, se verifica una sola vez el correo y el celular; luego sigue a donde iba.
  const next = redirectTarget(formData);
  try {
    await signIn("credentials", { email, password, redirectTo: `/verificar?callbackUrl=${encodeURIComponent(next)}` });
  } catch (error) {
    // La cuenta ya existe; si el login automático falla (p. ej. rate limit), que entre a mano.
    if (error instanceof AuthError) redirect("/login");
    throw error; // redirect de éxito
  }
  return {};
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
