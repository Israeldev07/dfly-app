import "server-only";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import {
  EMAIL_CODE_MAX_ATTEMPTS,
  EMAIL_CODE_TTL_MIN,
  emailCodeMatches,
  emailCodeMessage,
  generateEmailCode,
  hashEmailCode,
} from "./email-code";

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("Falta AUTH_SECRET");
  return value;
}

/** Genera un código nuevo (invalida el anterior y reinicia los intentos) y lo envía por email. */
export async function sendEmailCode(userId: string): Promise<"sent" | "already-verified"> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { name: true, email: true, emailVerified: true },
  });
  if (user.emailVerified) return "already-verified";

  const code = generateEmailCode();
  await prisma.user.update({
    where: { id: userId },
    data: {
      emailCodeHash: hashEmailCode(userId, code, secret()),
      emailCodeExpiresAt: new Date(Date.now() + EMAIL_CODE_TTL_MIN * 60_000),
      emailCodeAttempts: 0,
    },
    select: { id: true },
  });
  await sendEmail({ to: user.email, ...emailCodeMessage(user.name, code) });
  return "sent";
}

export type VerifyEmailResult = { ok: true } | { ok: false; reason: "wrong"; attemptsLeft: number } | { ok: false; reason: "expired" };

/** Comprueba el código. Cada intento se cuenta ANTES de comparar, así no se puede probar en paralelo. */
export async function verifyEmailCode(userId: string, code: string): Promise<VerifyEmailResult> {
  const now = new Date();
  const { count } = await prisma.user.updateMany({
    where: {
      id: userId,
      emailCodeHash: { not: null },
      emailCodeExpiresAt: { gt: now },
      emailCodeAttempts: { lt: EMAIL_CODE_MAX_ATTEMPTS },
    },
    data: { emailCodeAttempts: { increment: 1 } },
  });
  if (count === 0) return { ok: false, reason: "expired" };

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { emailCodeHash: true, emailCodeAttempts: true },
  });
  if (!user.emailCodeHash || !emailCodeMatches(user.emailCodeHash, userId, code, secret())) {
    const attemptsLeft = Math.max(0, EMAIL_CODE_MAX_ATTEMPTS - user.emailCodeAttempts);
    return attemptsLeft === 0 ? { ok: false, reason: "expired" } : { ok: false, reason: "wrong", attemptsLeft };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: now, emailCodeHash: null, emailCodeExpiresAt: null, emailCodeAttempts: 0 },
    select: { id: true },
  });
  return { ok: true };
}
