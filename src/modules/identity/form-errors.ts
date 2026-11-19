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
