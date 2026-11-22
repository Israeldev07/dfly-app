/** Errores de Zod por campo (el primero de cada uno), para devolverlos a los formularios. */
export function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}

export const SESSION_EXPIRED = "Tu sesión expiró. Vuelve a iniciar sesión.";

export type CodeState = {
  error?: string;
  /** Se envió un código y el usuario debe escribirlo. */
  sent?: boolean;
  verified?: boolean;
};

type CodeResult = { ok: true } | { ok: false; reason: "wrong"; attemptsLeft: number } | { ok: false; reason: "expired" };

/** Mensajes comunes a los dos códigos (correo y celular). */
export function codeResultState(result: CodeResult): CodeState {
  if (result.ok) return { verified: true };
  if (result.reason === "expired") return { error: "El código venció o se usaron todos los intentos. Pide uno nuevo." };
  return {
    sent: true,
    error: `El código no coincide. Te ${result.attemptsLeft === 1 ? "queda 1 intento" : `quedan ${result.attemptsLeft} intentos`}.`,
  };
}
