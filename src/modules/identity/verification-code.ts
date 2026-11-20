/**
 * Códigos de verificación (email y celular) y enlaces de recuperación de contraseña.
 * Puro (sin BD) para poder testearlo; la parte de servidor está en `verification-store.ts`.
 * Nada se guarda en claro: se guarda un HMAC con `AUTH_SECRET` ligado al propósito, al usuario y al destino,
 * así un código no sirve para otra cuenta, otro email ni otro número.
 */
import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export type CodePurpose = "EMAIL" | "PHONE";

export const CODE_LENGTH = 6;
export const CODE_MAX_ATTEMPTS = 5;
export const CODE_TTL_MIN: Record<CodePurpose, number> = { EMAIL: 15, PHONE: 10 };
export const RESET_TOKEN_TTL_MIN = 30;

export function generateCode() {
  return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, "0");
}

/** Normaliza lo que escribe el usuario ("123 456" → "123456"); null si no son 6 dígitos. */
export function normalizeCode(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  return digits.length === CODE_LENGTH ? digits : null;
}

export function hashCode(purpose: CodePurpose, userId: string, target: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`code:${purpose}:${userId}:${target}:${code}`).digest("hex");
}

export function codeMatches(
  storedHash: string,
  purpose: CodePurpose,
  userId: string,
  target: string,
  code: string,
  secret: string,
) {
  const a = Buffer.from(storedHash);
  const b = Buffer.from(hashCode(purpose, userId, target, code, secret));
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Token del enlace de recuperación: 256 bits, en la URL. Se busca por su hash. */
export function generateResetToken() {
  return randomBytes(32).toString("base64url");
}

export function hashResetToken(token: string, secret: string) {
  return createHmac("sha256", secret).update(`reset:${token}`).digest("hex");
}

/** Solo acepta la forma exacta de `generateResetToken` (43 caracteres base64url). */
export function isResetTokenShape(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
}
