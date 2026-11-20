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

/**
 * Qué cambia en la cuenta al usarse un enlace de recuperación. Abrirlo prueba que se lee el correo.
 * Si el correo nunca se había verificado, cualquiera pudo crear la cuenta con él (sin leerlo) y fijar
 * nombre y celular: eso se borra para que la dueña no herede, por ejemplo, el celular de un intruso,
 * adonde irían los avisos de sus pedidos. Pedir exige el correo verificado, así que no hay pedidos ni
 * direcciones que limpiar.
 */
export function passwordResetUpdate(emailVerified: Date | null, now: Date) {
  const base = { sessionsValidFrom: now };
  if (emailVerified) return { ...base, unproven: false as const };
  return {
    ...base,
    unproven: true as const,
    emailVerified: now,
    name: null,
    phone: null,
    phoneVerifiedAt: null,
    whatsappOptInAt: null,
  };
}
