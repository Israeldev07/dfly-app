/**
 * Verificación del celular: el usuario envía un código desde su WhatsApp al número de Dfly.
 * Así Dfly nunca escribe primero a un número que nadie demostró que es suyo.
 * Puro (sin BD) para poder testearlo; la parte de servidor está en `phone-verification.ts`.
 */
import { generateCode } from "@/lib/codes";

export const PHONE_CODE_LENGTH = 6;
export const PHONE_CODE_TTL_MIN = 30;

/** Mismo alfabeto que los códigos de pedido: sin 0/O ni 1/I/L. */
const CODE_RE = /(?:^|[^0-9A-Z])([2-9A-HJKMNP-Z]{6})(?![0-9A-Z])/g;

export function generatePhoneCode() {
  return generateCode(PHONE_CODE_LENGTH);
}

/** Texto que se precarga en WhatsApp. */
export function verificationText(code: string) {
  return `Verificar Dfly: ${code}`;
}

/** Enlace que abre WhatsApp con el mensaje listo para enviar a Dfly. */
export function verificationLink(dflyNumber: string, code: string) {
  return `https://wa.me/${dflyNumber.replace(/\D/g, "")}?text=${encodeURIComponent(verificationText(code))}`;
}

/** Candidatos a código dentro de un mensaje de texto (el usuario puede editarlo o escribirlo a mano). */
export function findPhoneCodes(text: string): string[] {
  const found = new Set<string>();
  for (const match of text.toUpperCase().matchAll(CODE_RE)) {
    found.add(match[1]);
    if (found.size === 3) break;
  }
  return [...found];
}

export const samePhone = (a: string, b: string) => a.replace(/\D/g, "") === b.replace(/\D/g, "");
