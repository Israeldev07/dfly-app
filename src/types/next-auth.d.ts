import type { DefaultSession } from "next-auth";
// `next-auth/jwt` y no `@auth/core/jwt`: @auth/core va anidado dentro de next-auth y solo se resolvía
// porque lo importaba el provider de Google.
import "next-auth/jwt";

type AppRole = "CUSTOMER" | "ADMIN";

declare module "next-auth" {
  interface User {
    role?: AppRole;
    /** Cuándo empezó el inicio de sesión (ms); lo fija `authorize`. */
    authAt?: number;
  }
  interface Session {
    user: {
      id: string;
      role: AppRole;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: AppRole;
    /** Cuándo se inició la sesión (ms). Las sesiones anteriores a este campo no lo traen. */
    authAt?: number;
  }
}
