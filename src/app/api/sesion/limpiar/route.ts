import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { safeCallbackUrl } from "@/lib/safe-callback";

/**
 * Borra la cookie de una sesión anulada (contraseña restablecida, cuenta borrada). En un Server Component
 * `auth()` detecta la anulación pero no puede escribir cookies; envuelto así, Auth.js añade a la respuesta
 * el `Set-Cookie` que la borra. A una sesión válida no la toca: un enlace a esta ruta no cierra la sesión
 * de nadie. Lo usa `identity/session.ts#requireUser`.
 */
export const GET = auth((request) => {
  const returnTo = safeCallbackUrl(request.nextUrl.searchParams.get("callbackUrl")) ?? "/comercios";
  const target = request.auth?.user
    ? new URL(returnTo, request.nextUrl)
    : new URL(`/login?callbackUrl=${encodeURIComponent(returnTo)}`, request.nextUrl);
  const response = NextResponse.redirect(target, 303);
  // Que ningún proxy o navegador guarde la redirección: depende de la cookie.
  response.headers.set("Cache-Control", "no-store");
  return response;
});
