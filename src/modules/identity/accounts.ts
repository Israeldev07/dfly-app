import "server-only";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

/** Crea la cuenta por credenciales. "email-taken" también si otro registro simultáneo ganó la carrera. */
export async function createCredentialsUser(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<"created" | "email-taken"> {
  const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) return "email-taken";
  try {
    await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        phone: input.phone,
        password: await bcrypt.hash(input.password, 12),
        whatsappOptInAt: new Date(),
      },
      select: { id: true },
    });
    return "created";
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return "email-taken";
    throw error;
  }
}

export async function updateUserName(userId: string, name: string) {
  await prisma.user.update({ where: { id: userId }, data: { name }, select: { id: true } });
}
