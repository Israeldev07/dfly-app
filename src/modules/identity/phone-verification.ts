import "server-only";
import { prisma } from "@/lib/db";
import { findPhoneCodes, generatePhoneCode, PHONE_CODE_TTL_MIN, samePhone, verificationText } from "./phone-code";

/**
 * Guarda el número (si cambió, deja de estar verificado) y genera un código nuevo.
 * Si ya estaba verificado ese mismo número, no hace falta código.
 */
export async function startPhoneVerification(userId: string, phone: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
  if (user.phoneVerifiedAt && user.phone && samePhone(user.phone, phone)) return { verified: true as const };

  const expiresAt = new Date(Date.now() + PHONE_CODE_TTL_MIN * 60_000);
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generatePhoneCode();
    try {
      await prisma.user.update({
        where: { id: userId },
        data: { phone, phoneVerifiedAt: null, phoneCode: code, phoneCodeExpiresAt: expiresAt },
        select: { id: true },
      });
      return { verified: false as const, code, expiresAt };
    } catch (error) {
      // Choque del código (muy improbable): se prueba con otro.
      if ((error as { code?: string }).code === "P2002") continue;
      throw error;
    }
  }
  throw new Error("No se pudo generar un código de verificación");
}

/**
 * Mensaje de texto entrante al WhatsApp de Dfly: si trae un código vigente y viene
 * DESDE el número que el usuario dijo tener, ese número queda verificado.
 * Idempotente: el código se borra al usarlo, así que un reenvío de Meta no hace nada.
 */
export async function verifyPhoneFromMessage(fromPhone: string, text: string): Promise<"verified" | "no-match"> {
  for (const code of findPhoneCodes(text)) {
    const user = await prisma.user.findUnique({
      where: { phoneCode: code },
      select: { id: true, phone: true, phoneCodeExpiresAt: true },
    });
    if (!user?.phone || !user.phoneCodeExpiresAt || user.phoneCodeExpiresAt < new Date()) continue;
    // El código solo vale si lo envía el dueño del número: así nadie verifica un número ajeno.
    if (!samePhone(user.phone, fromPhone)) continue;
    const now = new Date();
    const { count } = await prisma.user.updateMany({
      where: { id: user.id, phoneCode: code, phone: user.phone },
      data: { phoneVerifiedAt: now, phoneCode: null, phoneCodeExpiresAt: null },
    });
    if (count === 0) continue;
    // Escribir a Dfly para verificarse es una acción explícita del usuario: cuenta como consentimiento.
    await prisma.user.updateMany({ where: { id: user.id, whatsappOptInAt: null }, data: { whatsappOptInAt: now } });
    return "verified";
  }
  return "no-match";
}

/** El botón de simular solo existe en desarrollo. */
export function allowPhoneSimulation() {
  return process.env.NODE_ENV === "development";
}

/** Solo desarrollo: el mismo efecto que si el usuario enviara el código desde su celular. */
export async function simulatePhoneMessage(userId: string, code: string): Promise<boolean> {
  if (!allowPhoneSimulation()) return false;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
  if (!user?.phone) return false;
  return (await verifyPhoneFromMessage(user.phone, verificationText(code))) === "verified";
}

export async function phoneVerificationStatus(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true } });
  return { verified: Boolean(user?.phone && user.phoneVerifiedAt) };
}
