import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema, registrationCodeSchema } from "@/lib/validations/auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { clientIp, RATE_LIMITED_CODE } from "@/lib/rate-limit-rules";
import authConfig from "@/auth.config";
import { signInWithEmailCode } from "@/modules/identity/email-verification";
import { isSessionActive } from "@/modules/identity/session-validity";

class RateLimitedSignin extends CredentialsSignin {
  code = RATE_LIMITED_CODE;
}

/**
 * Hash bcrypt (coste 12) de una contraseña al azar. Se compara contra él cuando el email no existe,
 * para que la respuesta tarde lo mismo y no revele qué correos tienen cuenta.
 */
const DUMMY_HASH = "$2b$12$fX3QyIO6r89L.n6vXcTIbORMdvBPkxaWKyhQ52K0ZCSosX8UCCtlS";

const nextAuth = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  callbacks: {
    ...authConfig.callbacks,
    // Fuera del proxy, cada `auth()` comprueba que la cuenta siga existiendo y no haya anulado la sesión.
    async jwt(params) {
      const token = await authConfig.callbacks.jwt(params);
      if (params.user) return token;
      return token.id && (await isSessionActive(token.id, token.authAt)) ? token : null;
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        // Antes de leer la contraseña: si se restablece mientras tanto, esta sesión queda anulada.
        const startedAt = Date.now();
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;

        // Aquí y no en loginAction: el endpoint /api/auth/callback/credentials también llega a authorize.
        const byIp = await consumeRateLimit("login:ip", clientIp(request.headers));
        const byEmail = await consumeRateLimit("login:email", parsed.data.email);
        if (!byIp.ok || !byEmail.ok) throw new RateLimitedSignin();

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          select: { id: true, name: true, email: true, image: true, role: true, password: true },
        });
        // Siempre un bcrypt, exista o no la cuenta; mismo resultado para email inexistente y contraseña incorrecta.
        const valid = await bcrypt.compare(parsed.data.password, user?.password ?? DUMMY_HASH);
        if (!user?.password || !valid) return null;

        const { password: _password, ...safeUser } = user;
        return { ...safeUser, authAt: startedAt };
      },
    }),
    // Primer ingreso tras registrarse: el código que llegó al correo. Responde igual exista o no la cuenta.
    Credentials({
      id: "registration-code",
      credentials: { email: {}, ticket: {}, code: {} },
      async authorize(raw, request) {
        const startedAt = Date.now();
        const parsed = registrationCodeSchema.safeParse(raw);
        if (!parsed.success) return null;

        const byIp = await consumeRateLimit("login:ip", clientIp(request.headers));
        const byEmail = await consumeRateLimit("register-code:email", parsed.data.email);
        if (!byIp.ok || !byEmail.ok) throw new RateLimitedSignin();

        const user = await signInWithEmailCode(parsed.data.email, parsed.data.ticket, parsed.data.code);
        return user ? { ...user, authAt: startedAt } : null;
      },
    }),
  ],
});

export const { handlers, auth, signIn, signOut } = nextAuth;
