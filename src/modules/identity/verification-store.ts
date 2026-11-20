import "server-only";
import { prisma } from "@/lib/db";
import {
  CODE_MAX_ATTEMPTS,
  CODE_TTL_MIN,
  codeMatches,
  generateCode,
  hashCode,
  type CodePurpose,
} from "./verification-code";

export function authSecret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("Falta AUTH_SECRET");
  return value;
}

/** Crea un código nuevo para `target` y reemplaza el anterior del mismo propósito (reinicia los intentos). */
export async function issueCode(userId: string, purpose: CodePurpose, target: string) {
  const code = generateCode();
  const data = {
    target,
    codeHash: hashCode(purpose, userId, target, code, authSecret()),
    expiresAt: new Date(Date.now() + CODE_TTL_MIN[purpose] * 60_000),
    attempts: 0,
  };
  await prisma.verificationCode.upsert({
    where: { userId_purpose: { userId, purpose } },
    create: { userId, purpose, ...data },
    update: data,
    select: { id: true },
  });
  return { code, expiresAt: data.expiresAt };
}

/** Borra el código si el envío falló: así no queda uno vigente que el usuario nunca recibió. */
export async function discardCode(userId: string, purpose: CodePurpose) {
  await prisma.verificationCode.deleteMany({ where: { userId, purpose } });
}

export type CheckCodeResult =
  | { ok: true; target: string }
  | { ok: false; reason: "wrong"; attemptsLeft: number }
  | { ok: false; reason: "expired" };

/**
 * Comprueba el código. Cada intento se cuenta ANTES de comparar (`updateMany` condicionado), así no se
 * pueden probar varios en paralelo. Al acertar se borra; `onMatch` corre en la misma transacción.
 */
export async function checkCode(
  userId: string,
  purpose: CodePurpose,
  code: string,
  onMatch: (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0], target: string) => Promise<void>,
): Promise<CheckCodeResult> {
  const now = new Date();
  const { count } = await prisma.verificationCode.updateMany({
    where: { userId, purpose, expiresAt: { gt: now }, attempts: { lt: CODE_MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (count === 0) return { ok: false, reason: "expired" };

  const row = await prisma.verificationCode.findUnique({
    where: { userId_purpose: { userId, purpose } },
    select: { id: true, target: true, codeHash: true, attempts: true },
  });
  if (!row) return { ok: false, reason: "expired" };
  if (!codeMatches(row.codeHash, purpose, userId, row.target, code, authSecret())) {
    const attemptsLeft = Math.max(0, CODE_MAX_ATTEMPTS - row.attempts);
    return attemptsLeft === 0 ? { ok: false, reason: "expired" } : { ok: false, reason: "wrong", attemptsLeft };
  }

  // Si otro intento simultáneo ya lo usó (o se pidió otro código), `deleteMany` no borra nada y no se aplica.
  const applied = await prisma.$transaction(async (tx) => {
    const { count: deleted } = await tx.verificationCode.deleteMany({ where: { id: row.id, codeHash: row.codeHash } });
    if (deleted === 0) return false;
    await onMatch(tx, row.target);
    return true;
  });
  return applied ? { ok: true, target: row.target } : { ok: false, reason: "expired" };
}

/** El cron de limpieza borra los códigos y enlaces vencidos. */
export async function purgeExpiredCodes() {
  const { count } = await prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  return count;
}
