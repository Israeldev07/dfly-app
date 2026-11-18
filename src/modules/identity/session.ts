import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

/** Verifica la sesión junto al dato; el proxy es solo una capa optimista. */
export async function requireUser(returnTo: string) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(returnTo)}`);
  }
  return session.user;
}

/**
 * Páginas del panel. El rol se lee de la base de datos, no del JWT:
 * si a alguien se le quita ADMIN, pierde acceso sin esperar a que caduque su sesión.
 * A quien no es admin se le responde 404 para no revelar que el panel existe.
 */
export async function requireAdmin(returnTo: string) {
  const user = await requireUser(returnTo);
  if (!(await isAdmin(user.id))) notFound();
  return user;
}

/** Server Actions del panel: cada una lo llama por sí misma. */
export async function assertAdmin() {
  const session = await auth();
  const id = session?.user?.id;
  if (!id || !(await isAdmin(id))) throw new Error("No autorizado");
  return id;
}

// `cache`: el layout y la página del panel lo consultan en la misma petición.
const isAdmin = cache(async (userId: string) => {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  return row?.role === "ADMIN";
});
