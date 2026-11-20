import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { emailCodeMessage } from "./emails";
import { checkCode, discardCode, issueCode, type CheckCodeResult } from "./verification-store";

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
