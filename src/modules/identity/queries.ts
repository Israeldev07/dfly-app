import "server-only";
import { prisma } from "@/lib/db";

/** Lo que necesita `/perfil`. Nunca incluye la contraseña ni los códigos de verificación. */
export async function getProfile(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      phone: true,
      phoneVerifiedAt: true,
      addresses: { where: { isDefault: true }, select: { line: true, sector: true, city: true, reference: true }, take: 1 },
    },
  });
  return {
    name: user.name,
    email: user.email,
    emailVerified: Boolean(user.emailVerified),
    phone: user.phone,
    phoneVerified: Boolean(user.phone && user.phoneVerifiedAt),
    address: user.addresses[0] ?? null,
  };
}

/** Lo que necesita el checkout: estado de verificación y la dirección por defecto para precargar. */
export async function getCheckoutProfile(userId: string) {
  const [user, address] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { phone: true, phoneVerifiedAt: true, emailVerified: true } }),
    prisma.address.findFirst({ where: { userId, isDefault: true }, select: { line: true, sector: true, reference: true } }),
  ]);
  return {
    phone: user?.phone ?? null,
    phoneVerified: Boolean(user?.phone && user.phoneVerifiedAt),
    emailVerified: Boolean(user?.emailVerified),
    address,
  };
}
