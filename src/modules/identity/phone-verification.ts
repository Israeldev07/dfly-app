import "server-only";
import { prisma } from "@/lib/db";
import { sendAuthCode } from "@/modules/messaging/auth-code";
import { samePhone } from "./account-rules";
import { checkCode, discardCode, issueCode, type CheckCodeResult } from "./verification-store";

/**
 * Envía por WhatsApp un código al número que el usuario dice tener. El número guardado no cambia
 * hasta que escriba el código: así un número verificado no se pierde por pedir uno para otro.
 * Si ya estaba verificado ese mismo número, no hace falta código.
 */
export async function sendPhoneCode(userId: string, phone: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
  if (user.phoneVerifiedAt && user.phone && samePhone(user.phone, phone)) return { verified: true as const };

  const { code, expiresAt } = await issueCode(userId, "PHONE", phone);
  try {
    await sendAuthCode(phone, code);
  } catch (error) {
    await discardCode(userId, "PHONE");
    throw error;
  }
  return { verified: false as const, expiresAt };
}

/**
 * Acertar el código demuestra que el número es suyo: queda guardado y verificado. Pedir el código por
 * WhatsApp es una acción explícita del usuario, así que cuenta también como consentimiento.
 */
export async function verifyPhoneCode(userId: string, code: string): Promise<CheckCodeResult> {
  return checkCode(userId, "PHONE", code, async (tx, target) => {
    const now = new Date();
    await tx.user.update({ where: { id: userId }, data: { phone: target, phoneVerifiedAt: now }, select: { id: true } });
    await tx.user.updateMany({ where: { id: userId, whatsappOptInAt: null }, data: { whatsappOptInAt: now } });
  });
}
