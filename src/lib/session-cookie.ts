/**
 * Cookie de sesión de Auth.js: `authjs.session-token` (con `__Secure-` en https), partida en
 * `.0`, `.1`… cuando el JWT no cabe en una sola. Puro para poder testearlo.
 */
const SESSION_COOKIE = /^(__Secure-)?authjs\.session-token(\.\d+)?$/;

export function hasSessionCookie(names: Iterable<string>): boolean {
  for (const name of names) if (SESSION_COOKIE.test(name)) return true;
  return false;
}

/**
 * Ruta que borra una cookie de sesión anulada y lleva a `/login`, que luego vuelve a `returnTo`
 * (ver `api/sesion/limpiar`).
 */
export function clearSessionUrl(returnTo: string) {
  return `/api/sesion/limpiar?callbackUrl=${encodeURIComponent(returnTo)}`;
}
