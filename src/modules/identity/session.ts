import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { clearSessionUrl, hasSessionCookie } from "@/lib/session-cookie";
import { prisma } from "@/lib/db";

/** Verifica la sesión junto al dato; el proxy es solo una capa optimista. */
export async function requireUser(returnTo: string) {
  const session = await auth();
  if (!session?.user?.id) {
    // Hay cookie pero la sesión se anuló: aquí no se puede borrar (es un Server Component), así que se
    // pasa por la ruta que la borra; si no, el navegador la seguiría enviando en cada petición.
    const names = (await cookies()).getAll().map((c) => c.name);
    if (hasSessionCookie(names)) redirect(clearSessionUrl(returnTo));
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
