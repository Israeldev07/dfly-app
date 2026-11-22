"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { clearRateLimit, clientIp, consumeRateLimit } from "@/lib/rate-limit";
import { loginEmailKey, retryAfterLabel } from "@/lib/rate-limit-rules";
import { forgotPasswordSchema, resetPasswordSchema } from "@/lib/validations/auth";
import { fieldErrorsFrom } from "./form-errors";
import { requestPasswordReset, resetPassword } from "./password-reset";

export type ForgotPasswordState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: { email: string };
  /** La respuesta es la misma exista o no la cuenta. */
  done?: boolean;
};

export async function forgotPasswordAction(_prev: ForgotPasswordState, formData: FormData): Promise<ForgotPasswordState> {
  const raw = { email: String(formData.get("email") ?? "") };
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: raw };

  const byIp = await consumeRateLimit("password-reset:ip", clientIp(await headers()));
  if (!byIp.ok) {
    return { error: `Demasiadas solicitudes desde esta conexión. Inténtalo en ${retryAfterLabel(byIp.retryAfterSec)}.`, values: raw };
  }
  // Por correo, en silencio: decir "ya te enviamos varios" revelaría que la cuenta existe.
  const byEmail = await consumeRateLimit("password-reset:email", parsed.data.email);
  if (byEmail.ok) {
    try {
      await requestPasswordReset(parsed.data.email);
    } catch (error) {
      console.error("[password-reset] no se pudo enviar el enlace", error);
      return { error: "No pudimos enviar el correo. Inténtalo en unos minutos.", values: raw };
    }
  }
  return { done: true, values: { email: parsed.data.email } };
}

export type ResetPasswordState = { error?: string; fieldErrors?: Partial<Record<string, string>> };

export async function resetPasswordAction(_prev: ResetPasswordState, formData: FormData): Promise<ResetPasswordState> {
  const raw = {
    token: String(formData.get("token") ?? ""),
    password: String(formData.get("password") ?? ""),
    confirm: String(formData.get("confirm") ?? ""),
  };
  const parsed = resetPasswordSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues) };

  const result = await resetPassword(parsed.data.token, parsed.data.password);
  if (result === "invalid") {
    return { error: "Este enlace ya se usó o venció. Pide uno nuevo." };
  }
  // Quien abrió el enlace es el dueño: que un tercero lo haya bloqueado no le impide entrar ya.
  const ip = clientIp(await headers());
  await clearRateLimit("login:email", result.email);
  await clearRateLimit("login:email-ip", loginEmailKey(result.email, ip));
  // Todas las sesiones quedaron anuladas: se entra de nuevo con la contraseña nueva.
  redirect("/login?restablecida=1");
}
