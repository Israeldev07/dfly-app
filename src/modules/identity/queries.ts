import "server-only";
import { prisma } from "@/lib/db";
import { verificationStatus } from "./account-rules";

const VERIFICATION_SELECT = {
  email: true,
  emailVerified: true,
  phone: true,
  phoneVerifiedAt: true,
  // Código de WhatsApp pendiente: al volver a la página se sigue esperando el mismo.
  verificationCodes: { where: { purpose: "PHONE" }, select: { target: true, expiresAt: true } },
} as const;

type VerificationRow = {
  email: string;
  emailVerified: Date | null;
  phone: string | null;
  phoneVerifiedAt: Date | null;
  verificationCodes: { target: string; expiresAt: Date }[];
};

function verificationView(user: VerificationRow) {
  const status = verificationStatus(user);
  const pending = user.verificationCodes.find((c) => c.expiresAt > new Date());
  return {
    email: user.email,
    emailVerified: status.email,
    phone: user.phone,
    phoneVerified: status.phone,
    verified: status.complete,
    pendingPhone: pending?.target ?? null,
  };
}

/** Estado de la verificación de la cuenta (correo y celular). Nunca incluye códigos ni contraseña. */
export async function getVerification(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: VERIFICATION_SELECT });
  return verificationView(user);
}

/** Lo que necesita `/perfil`. */
export async function getProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      ...VERIFICATION_SELECT,
      name: true,
      addresses: { where: { isDefault: true }, select: { line: true, sector: true, city: true, reference: true }, take: 1 },
    },
  });
  return { ...verificationView(user), name: user.name, address: user.addresses[0] ?? null };
}

/** Lo que necesita el checkout: estado de las verificaciones y la dirección por defecto para precargar. */
export async function getCheckoutProfile(userId: string) {
  const [verification, address] = await Promise.all([
    getVerification(userId),
    prisma.address.findFirst({ where: { userId, isDefault: true }, select: { line: true, sector: true, reference: true } }),
  ]);
  return { ...verification, address };
}
