import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { isSessionCurrent } from "./account-rules";

// `cache`: el layout y la página consultan la sesión en la misma petición.
const sessionCutoff = cache(async (userId: string) =>
  prisma.user.findUnique({ where: { id: userId }, select: { sessionsValidFrom: true } }),
);

/** La sesión deja de valer si la cuenta se borró o anuló sus sesiones (p. ej. al restablecer la contraseña). */
export async function isSessionActive(userId: string, authAt: number | undefined) {
  const user = await sessionCutoff(userId);
  return user !== null && isSessionCurrent(authAt, user.sessionsValidFrom);
}
