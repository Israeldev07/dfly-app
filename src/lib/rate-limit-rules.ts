/**
 * Políticas de rate limiting (ventana fija). Puro para poder testearlo;
 * el contador vive en Postgres (`rate-limit.ts`).
 * `blockSec`: al superar el límite, el bloqueo dura al menos esto desde ese momento
 * (sin él, quien se pasa al final de la ventana esperaría solo lo que le queda).
 */
export const RATE_LIMITS = {
  /** Intentos de login por IP: frena barridos de muchas cuentas desde un origen. */
  "login:ip": { limit: 30, windowSec: 15 * 60, blockSec: 15 * 60 },
  /** Intentos de login por email: frena fuerza bruta contra una cuenta. */
  "login:email": { limit: 8, windowSec: 15 * 60, blockSec: 15 * 60 },
  "register:ip": { limit: 5, windowSec: 60 * 60 },
  /** Correos que salen al registrarse (código o aviso de cuenta existente) por dirección. Se aplica en silencio. */
  "register:email": { limit: 3, windowSec: 60 * 60 },
  /** Intentos de entrar con el código del registro, por correo (además de `login:ip`). */
  "register-code:email": { limit: 10, windowSec: 15 * 60, blockSec: 15 * 60 },
  /** Cada pedido genera mensajes de WhatsApp al dueño y al comercio. */
  "order:user": { limit: 5, windowSec: 10 * 60 },
  /** Códigos al correo de la cuenta. */
  "email-code:user": { limit: 5, windowSec: 60 * 60 },
  /** Cada código por WhatsApp cuesta (plantilla de autenticación): por cuenta, por número y por IP. */
  "phone-code:user": { limit: 5, windowSec: 60 * 60 },
  "phone-code:phone": { limit: 3, windowSec: 60 * 60 },
  "phone-code:ip": { limit: 10, windowSec: 60 * 60 },
  /** Enlaces de recuperación: por correo (no inundar un buzón) y por IP (no barrer correos). */
  "password-reset:email": { limit: 3, windowSec: 60 * 60 },
  "password-reset:ip": { limit: 10, windowSec: 60 * 60 },
} as const satisfies Record<string, { limit: number; windowSec: number; blockSec?: number }>;

export type RateLimitPolicy = keyof typeof RATE_LIMITS;

/** Código del `CredentialsSignin` que lanza `authorize` al superar el límite (viaja en la URL). */
export const RATE_LIMITED_CODE = "rate_limited";

/**
 * De qué cabecera sale la IP del cliente. Solo vale la que escribe un proxy de confianza: cualquier otra
 * la puede inventar el cliente para saltarse los límites por IP. Se elige con `TRUSTED_PROXY`:
 * - `vercel` (por defecto en Vercel): `x-vercel-forwarded-for`, que Vercel fija y no deja inyectar.
 * - `cloudflare`: `cf-connecting-ip`. Solo es fiable si el servidor no acepta tráfico que no venga de Cloudflare.
 * - `xff:N`: hay N proxies propios delante, cada uno añade la IP que lo llamó al final de `x-forwarded-for`;
 *   la del cliente es la N-ésima desde la derecha (lo de la izquierda lo pudo escribir el cliente).
 * - `none`: no se confía en ninguna; los límites por IP no se aplican (los de por correo y cuenta, sí).
 */
export type IpSource = { kind: "vercel" } | { kind: "cloudflare" } | { kind: "xff"; hops: number } | { kind: "none" };

export function parseIpSource(value: string | undefined): IpSource | null {
  const v = value?.trim().toLowerCase();
  if (v === "vercel" || v === "cloudflare" || v === "none") return { kind: v };
  const xff = v?.match(/^xff:([1-9])$/);
  return xff ? { kind: "xff", hops: Number(xff[1]) } : null;
}

/** Recorta y descarta lo que no parece una IP (una cabecera mal formada no debe crear cubos arbitrarios). */
function cleanIp(value: string | null | undefined): string | null {
  const ip = value?.trim();
  return ip && ip.length <= 64 && /^[0-9a-fA-F:.]+$/.test(ip) ? ip : null;
}

/** IP del cliente según la fuente de confianza; null si no se puede saber. */
export function clientIpFrom(headers: Headers, source: IpSource): string | null {
  switch (source.kind) {
    case "vercel":
      return cleanIp(headers.get("x-vercel-forwarded-for")?.split(",")[0]);
    case "cloudflare":
      return cleanIp(headers.get("cf-connecting-ip"));
    case "xff": {
      const hops = (headers.get("x-forwarded-for") ?? "").split(",").map((h) => h.trim()).filter(Boolean);
      return hops.length >= source.hops ? cleanIp(hops[hops.length - source.hops]) : null;
    }
    case "none":
      return null;
  }
}

/**
 * La fuente configurada. Sin `TRUSTED_PROXY`: Vercel si corre ahí (`VERCEL=1`); en desarrollo, el
 * `x-forwarded-for` que pone el propio `next dev`; en producción fuera de Vercel, ninguna (no se adivina).
 */
export function resolveIpSource(env: { TRUSTED_PROXY?: string; VERCEL?: string; NODE_ENV?: string }): {
  source: IpSource;
  warning?: string;
} {
  if (env.TRUSTED_PROXY) {
    const parsed = parseIpSource(env.TRUSTED_PROXY);
    if (parsed) return { source: parsed };
    return {
      source: { kind: "none" },
      warning: `TRUSTED_PROXY="${env.TRUSTED_PROXY}" no es válido (vercel, cloudflare, xff:N o none): límites por IP desactivados`,
    };
  }
  if (env.VERCEL === "1") return { source: { kind: "vercel" } };
  if (env.NODE_ENV !== "production") return { source: { kind: "xff", hops: 1 } };
  return {
    source: { kind: "none" },
    warning: "Fuera de Vercel y sin TRUSTED_PROXY: límites por IP desactivados (configúralo según tu proxy)",
  };
}

export function retryAfterLabel(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return minutes === 1 ? "1 minuto" : `${minutes} minutos`;
}
