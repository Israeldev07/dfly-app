# Autenticación — Auth.js (NextAuth.js v5)

## Inicio de sesión
Solo **credenciales** (email + contraseña) con el provider `Credentials` (decisión del dueño, 2026-11-19: se quitó Google).
Tras registrarse, el cliente verifica una sola vez el correo y el celular con un código de 6 dígitos; hay recuperación
de contraseña por enlace al correo. Volver a añadir OAuth requiere decisión explícita y revisar cómo convive con
cuentas por contraseña cuyo email nadie verificó.

## Arquitectura (config dividida)
- `src/auth.config.ts`: objeto `NextAuthConfig` **sin adapter** (providers, `pages`, callbacks). Es lo que importa el proxy.
- `src/auth.ts`: `NextAuth({ adapter: PrismaAdapter(prisma), session: { strategy: "jwt" }, ...authConfig })` y exporta `{ handlers, auth, signIn, signOut }`.
- `src/app/api/auth/[...nextauth]/route.ts`: `export const { GET, POST } = handlers`.
- `src/proxy.ts`: instancia `NextAuth(authConfig)` sin adapter y exporta `auth` como `proxy`.

## Reglas
- Estrategia de sesión **`jwt`** obligatoria (el provider Credentials no funciona con sesiones en base de datos).
- Contraseñas hasheadas con **bcrypt** (o argon2); nunca almacenar ni loguear texto plano. El campo `password` en `User` es opcional (las cuentas antiguas creadas con Google no lo tienen y lo fijan con la recuperación de contraseña).
- `authorize()` valida las credenciales con Zod antes de consultar la base de datos y devuelve `null` ante credenciales inválidas, sin revelar si el email existe.
- Datos extra en sesión (p. ej. `id`, `role`) se propagan con los callbacks `jwt` y `session`, y se tipan extendiendo los módulos `next-auth` / `next-auth/jwt` en `src/types/next-auth.d.ts`.
- Obtener la sesión en servidor con `await auth()`. En componentes cliente, `useSession` dentro de `SessionProvider` solo si es imprescindible.
- Cada Server Action y Route Handler protegido verifica la sesión (y el rol si aplica) por sí mismo; no depender solo del proxy.
- Variables de entorno: `AUTH_SECRET` (también firma códigos y enlaces), `AUTH_URL` (si aplica en producción), `APP_URL`, `DATABASE_URL`, y SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).
- Páginas personalizadas en `pages: { signIn: "/login" }`.
