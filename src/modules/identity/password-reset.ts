import "server-only";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { appUrl, sendEmail } from "@/lib/email";
import { accountExistsMessage, passwordResetMessage } from "./emails";
import { generateResetToken, hashResetToken, isResetTokenShape, RESET_TOKEN_TTL_MIN } from "./verification-code";
import { authSecret } from "./verification-store";

/**
 * Envía el enlace de recuperación si existe la cuenta. Quien llama responde igual exista o no,
 * para no revelar qué correos están registrados.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return;
  const link = await issueResetLink(user.id, user.email);
  await sendEmail(passwordResetMessage(user.email, user.name, link));
}

/**
 * Alguien intentó registrarse con un correo que ya tiene cuenta. Se avisa a ese correo (no a quien
 * llenó el formulario) con un enlace para recuperar el acceso; el formulario responde lo mismo que
 * con un correo nuevo, así el registro no revela qué correos están registrados.
 */
export async function notifyExistingAccount(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true, name: true, email: true } });
  if (!user) return;
  const link = await issueResetLink(user.id, user.email);
  await sendEmail(accountExistsMessage(user.email, user.name, link));
}

/** Crea un enlace de recuperación (invalida el anterior) y devuelve la URL. */
async function issueResetLink(userId: string, email: string): Promise<string> {
  const token = generateResetToken();
  const data = {
    target: email,
    codeHash: hashResetToken(token, authSecret()),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60_000),
    attempts: 0,
  };
  // Uno vigente por cuenta: pedir otro invalida el enlace anterior.
  await prisma.verificationCode.upsert({
    where: { userId_purpose: { userId, purpose: "PASSWORD_RESET" } },
    create: { userId, purpose: "PASSWORD_RESET", ...data },
    update: data,
    select: { id: true },
  });
  return `${appUrl()}/recuperar/nueva?token=${encodeURIComponent(token)}`;
}

/** ¿El enlace sigue sirviendo? Lo usa la página para no mostrar el formulario a un enlace vencido. */
export async function isResetTokenValid(token: unknown): Promise<boolean> {
  if (!isResetTokenShape(token)) return false;
  const row = await findResetRow(token);
  return Boolean(row);
}

/**
 * Fija la contraseña nueva. Consume el enlace, anula todas las sesiones abiertas (`sessionsValidFrom`)
 * y, como solo quien lee ese correo pudo abrirlo, deja el email verificado.
 */
export async function resetPassword(token: string, password: string): Promise<"ok" | "invalid"> {
  if (!isResetTokenShape(token)) return "invalid";
  const row = await findResetRow(token);
  if (!row) return "invalid";

  const hash = await bcrypt.hash(password, 12);
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    // Condicionado al hash: dos envíos simultáneos del mismo enlace no lo usan dos veces.
    const { count } = await tx.verificationCode.deleteMany({ where: { id: row.id, codeHash: row.codeHash, expiresAt: { gt: now } } });
    if (count === 0) return "invalid" as const;
    const { count: updated } = await tx.user.updateMany({
      where: { id: row.userId, email: row.target },
      data: { password: hash, sessionsValidFrom: now },
    });
    if (updated === 0) return "invalid" as const;
    await tx.user.updateMany({ where: { id: row.userId, emailVerified: null }, data: { emailVerified: now } });
    return "ok" as const;
  });
}

async function findResetRow(token: string) {
  const row = await prisma.verificationCode.findUnique({
    where: { codeHash: hashResetToken(token, authSecret()) },
    select: { id: true, userId: true, target: true, codeHash: true, purpose: true, expiresAt: true },
  });
  return row && row.purpose === "PASSWORD_RESET" && row.expiresAt > new Date() ? row : null;
}
