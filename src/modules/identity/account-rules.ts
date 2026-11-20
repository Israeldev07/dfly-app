/** Reglas puras de la cuenta (sin BD), para poder testearlas. */

export const samePhone = (a: string, b: string) => a.replace(/\D/g, "") === b.replace(/\D/g, "");

/** "+593991234567" o "0991234567" → "099 123 4567". */
export function displayPhone(phone: string) {
  const local = phone.replace(/^\+593/, "0").replace(/\D/g, "");
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : phone;
}

/**
 * Una sesión iniciada en `authAt` (ms) vale si no hay corte o empezó después de él.
 * Sin `authAt` (sesiones de antes de este campo) solo vale mientras no haya corte.
 */
export function isSessionCurrent(authAt: number | undefined, sessionsValidFrom: Date | null): boolean {
  if (!sessionsValidFrom) return true;
  return (authAt ?? 0) >= sessionsValidFrom.getTime();
}

/** Para pedir hay que tener verificados el correo y el celular (se hace una sola vez, tras registrarse). */
export function verificationStatus(user: { emailVerified: Date | null; phone: string | null; phoneVerifiedAt: Date | null }) {
  const email = Boolean(user.emailVerified);
  const phone = Boolean(user.phone && user.phoneVerifiedAt);
  return { email, phone, complete: email && phone };
}
