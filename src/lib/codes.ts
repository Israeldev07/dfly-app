import { randomInt } from "node:crypto";

// Sin caracteres ambiguos (0/O, 1/I/L) para dictarlo por teléfono o copiarlo sin errores.
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

/** Código aleatorio legible (pedidos, verificación del celular). Solo servidor: usa node:crypto. */
export function generateCode(length: number) {
  let code = "";
  for (let i = 0; i < length; i++) code += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return code;
}
