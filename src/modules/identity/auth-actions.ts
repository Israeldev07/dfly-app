"use server";

import { AuthError, CredentialsSignin } from "next-auth";
import { headers } from "next/headers";
import { after } from "next/server";
import { signIn, signOut } from "@/auth";
import { clientIp, consumeRateLimit, peekRateLimit } from "@/lib/rate-limit";
import { loginEmailKey, RATE_LIMITED_CODE, retryAfterLabel, UNVERIFIED_CODE } from "@/lib/rate-limit-rules";
import { safeCallbackUrl } from "@/lib/safe-callback";
import { loginSchema, registerSchema, registrationCodeSchema } from "@/lib/validations/auth";
import { createCredentialsUser } from "./accounts";
import { resendRegistrationCode, sendEmailCode } from "./email-verification";
import { fieldErrorsFrom } from "./form-errors";
import { notifyExistingAccount, requestPasswordReset } from "./password-reset";
import { generateResetToken, registrationTicket } from "./verification-code";
import { authSecret } from "./verification-store";

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
    if (error instanceof CredentialsSignin && error.code === UNVERIFIED_CODE) {
      // Solo llega aquí quien acertó la contraseña, así que decirlo no revela qué correos tienen cuenta.
      // El enlace de recuperación prueba que lee el correo; en silencio por el mismo límite de envíos.
      const email = parsed.data.email;
      if ((await consumeRateLimit("password-reset:email", email)).ok) {
        after(async () => {
          try {
            await requestPasswordReset(email);
          } catch (error) {
            console.error("[password-reset] no se pudo enviar el enlace de confirmación", error);
          }
        });
      }
      return {
        error: `Aún no confirmaste tu correo. Te enviamos un enlace a ${email}: ábrelo para confirmarlo y elegir tu contraseña.`,
        values,
      };
    }
    if (error instanceof AuthError) {
      return { error: "El correo o la contraseña no coinciden.", values };
    }
    throw error; // redirect de éxito
  }
  return {};
}

export type RegisterState = FormState & {
  /** Paso 2: escribir el código. Se responde igual exista o no el correo. */
  pending?: { email: string; ticket: string };
  /** Se reenvió el código (o se fingió reenviarlo). */
  resent?: boolean;
};

/**
 * Crea la cuenta y envía un código al correo. Si el correo ya tenía cuenta, no lo dice: a ese correo le
 * llega un aviso con un enlace para recuperar el acceso y aquí se responde igual que con uno nuevo.
 * Los correos salen con `after()`, así el tiempo de respuesta tampoco delata cuál de los dos casos fue.
 */
export async function registerAction(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = { name: raw.name ?? "", email: raw.email ?? "", phone: raw.phone ?? "", whatsappOptIn: raw.whatsappOptIn ?? "" };
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values };
  }
  const { name, email, phone, password } = parsed.data;

  const limit = await consumeRateLimit("register:ip", clientIp(await headers()));
  if (!limit.ok) {
    return { error: `Demasiados registros desde esta conexión. Inténtalo en ${retryAfterLabel(limit.retryAfterSec)}.`, values };
  }

  const created = await createCredentialsUser({ name, email, phone, password });
  // Por correo y en silencio: avisar "ya te enviamos varios" revelaría que el correo existe.
  const mayEmail = (await consumeRateLimit("register:email", email)).ok;
  if (mayEmail) {
    after(async () => {
      try {
        if (created === "email-taken") await notifyExistingAccount(email);
        else await sendEmailCode(created.id);
      } catch (error) {
        console.error("[email] no se pudo enviar el correo del registro", error);
      }
    });
  }

  const ticket = created === "email-taken" ? generateResetToken() : registrationTicket(created.id, email, authSecret());
  return { pending: { email, ticket }, values };
}

/** Paso 2 del registro: el código del correo es el primer inicio de sesión. */
export async function confirmRegistrationAction(prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const pending = prev.pending;
  if (!pending) return prev;
  const parsed = registrationCodeSchema.safeParse({ email: pending.email, ticket: pending.ticket, code: formData.get("code") ?? "" });
  if (!parsed.success) return { ...prev, resent: false, error: "Escribe los 6 dígitos del código." };

  const next = redirectTarget(formData);
  try {
    await signIn("registration-code", { ...parsed.data, redirectTo: `/verificar?callbackUrl=${encodeURIComponent(next)}` });
  } catch (error) {
    if (error instanceof CredentialsSignin && error.code === RATE_LIMITED_CODE) {
      return { ...prev, resent: false, error: "Demasiados intentos. Espera 15 minutos o pide un código nuevo." };
    }
    if (error instanceof AuthError) {
      return { ...prev, resent: false, error: "El código no coincide o venció. Revisa el último correo que te enviamos o pide otro." };
    }
    throw error; // redirect de éxito
  }
  return prev;
}

/** "Reenviar código" desde el registro. Siempre responde lo mismo. */
export async function resendRegistrationCodeAction(prev: RegisterState): Promise<RegisterState> {
  const pending = prev.pending;
  if (!pending) return prev;
  const mayEmail = (await consumeRateLimit("register:email", pending.email)).ok;
  if (mayEmail) {
    after(async () => {
      try {
        await resendRegistrationCode(pending.email, pending.ticket);
      } catch (error) {
        console.error("[email] no se pudo reenviar el código del registro", error);
      }
    });
  }
  return { ...prev, error: undefined, resent: true };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

/** La espera que ve el usuario es la del bloqueo más largo (por IP, por email desde esta IP o por email). */
async function loginRetryAfterSec(email: string) {
  const ip = clientIp(await headers());
  const checks = await Promise.all([
    peekRateLimit("login:ip", ip),
    peekRateLimit("login:email-ip", loginEmailKey(email, ip)),
    peekRateLimit("login:email", email),
  ]);
  return Math.max(...checks.map((c) => (c.ok ? 0 : c.retryAfterSec)), 60);
}

function redirectTarget(formData: FormData) {
  const raw = formData.get("callbackUrl");
  return safeCallbackUrl(typeof raw === "string" ? raw : undefined) ?? "/comercios";
}
