/**
 * Verificación del email con un código de 6 dígitos que se envía por correo.
 * Puro (sin BD) para poder testearlo; la parte de servidor está en `email-verification.ts`.
 * El código lo escribe el usuario, así que se guarda como HMAC y tiene intentos limitados.
 */
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const EMAIL_CODE_TTL_MIN = 15;
export const EMAIL_CODE_MAX_ATTEMPTS = 5;

export function generateEmailCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Normaliza lo que escribe el usuario ("123 456" → "123456"); null si no son 6 dígitos. */
export function normalizeEmailCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === 6 ? digits : null;
}

/** Ligado al usuario: el mismo código no sirve para otra cuenta. */
export function hashEmailCode(userId: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`email-code:${userId}:${code}`).digest("hex");
}

export function emailCodeMatches(storedHash: string, userId: string, code: string, secret: string) {
  const a = Buffer.from(storedHash);
  const b = Buffer.from(hashEmailCode(userId, code, secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function emailCodeMessage(name: string | null, code: string) {
  const greeting = name?.trim() ? `Hola ${name.trim().split(/\s+/)[0]},` : "Hola,";
  const subject = `Tu código de Dfly: ${code}`;
  const text = [
    greeting,
    "",
    `Tu código para verificar tu email en Dfly es: ${code}`,
    "",
    `Vence en ${EMAIL_CODE_TTL_MIN} minutos. Si no lo pediste, ignora este mensaje.`,
  ].join("\n");
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;color:#262626;font-size:16px;line-height:1.5">
<p>${escapeHtml(greeting)}</p>
<p>Tu código para verificar tu email en Dfly es:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
<p style="color:#5c5c5c;font-size:14px">Vence en ${EMAIL_CODE_TTL_MIN} minutos. Si no lo pediste, ignora este mensaje.</p>
</div>`;
  return { subject, text, html };
}
