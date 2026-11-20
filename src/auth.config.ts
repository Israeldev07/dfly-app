import type { NextAuthConfig } from "next-auth";

const PROTECTED_PREFIXES = ["/comercios", "/checkout", "/pedidos", "/perfil", "/verificar", "/ayuda", "/admin"];
const AUTH_PAGES = ["/login", "/registro", "/recuperar"];

/**
 * Config sin adapter ni acceso a base de datos: la importa el proxy.
 * El único provider (Credentials) se añade en `auth.ts` porque consulta Prisma.
 */
export default {
  providers: [],
  pages: { signIn: "/login" },
  callbacks: {
    // Capa optimista: la autorización real se verifica junto al dato.
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const path = nextUrl.pathname;

      // Las páginas de login, registro y recuperación no redirigen aquí: el proxy no ve si la sesión se
      // anuló (`isSessionActive`), y una sesión anulada quedaría en un bucle /comercios ⇄ /login.
      // Las redirige `(auth)/layout.tsx`, que usa la sesión completa.
      if (AUTH_PAGES.some((p) => path.startsWith(p))) return true;
      // `/admin` solo exige sesión aquí: el rol del JWT se fija al iniciar sesión y no se refresca,
      // así que quien decide es `requireAdmin`, que lo lee de la base de datos.
      if (PROTECTED_PREFIXES.some((p) => path.startsWith(p))) {
        return isLoggedIn;
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = user.role ?? "CUSTOMER";
        // Se fija al iniciar sesión y no cambia al refrescar el token (a diferencia de `iat`).
        // `authorize` lo toma antes de leer la contraseña, para no ganarle a un restablecimiento.
        token.authAt = user.authAt ?? Date.now();
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      return session;
    },
  },
} satisfies NextAuthConfig;
