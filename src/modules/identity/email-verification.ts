import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailCodeMessage } from "./emails";
import { ticketMatches } from "./verification-code";
import { authSecret, checkCode, discardCode, issueCode, type CheckCodeResult } from "./verification-store";

/** Genera un código nuevo (invalida el anterior) y lo envía al correo de la cuenta. */
export async function sendEmailCode(userId: string): Promise<"sent" | "already-verified"> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, emailVerified: true },
  });
  if (user.emailVerified) return "already-verified";

  const { code } = await issueCode(userId, "EMAIL", user.email);
  try {
    await sendEmail(emailCodeMessage(user.email, user.name, code));
  } catch (error) {
    await discardCode(userId, "EMAIL");
    throw error;
  }
  return "sent";
}

/** El código solo vale para el email al que se envió: si la cuenta cambiara de email, no lo verifica. */
export async function verifyEmailCode(userId: string, code: string): Promise<CheckCodeResult> {
  return checkCode(userId, "EMAIL", code, async (tx, target) => {
    const { count } = await tx.user.updateMany({
      where: { id: userId, email: target },
      data: { emailVerified: new Date() },
    });
    if (count === 0) throw new Error("El email de la cuenta cambió mientras se verificaba");
  });
}

/** Cuenta a la que pertenece un ticket de registro; null si el ticket no corresponde (o el correo no existe). */
async function userForTicket(email: string, ticket: string) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true, image: true, role: true },
  });
  return user && ticketMatches(ticket, user.id, user.email, authSecret()) ? user : null;
}

/**
 * Primer inicio de sesión tras registrarse: el código del correo hace de credencial (lo usa el provider
 * `registration-code` de `auth.ts`). Exige el ticket que recibió quien creó la cuenta: así nadie entra
 * con el código a una cuenta que ya existía. Devuelve null igual si el correo no tiene cuenta.
 */
export async function signInWithEmailCode(email: string, ticket: string, code: string) {
  const user = await userForTicket(email, ticket);
  if (!user) return null;
  const result = await verifyEmailCode(user.id, code);
  return result.ok ? user : null;
}

/** "Reenviar código" desde el registro. Con un ticket que no corresponde no hace nada (y no lo dice). */
export async function resendRegistrationCode(email: string, ticket: string): Promise<void> {
  const user = await userForTicket(email, ticket);
  if (user) await sendEmailCode(user.id);
}
