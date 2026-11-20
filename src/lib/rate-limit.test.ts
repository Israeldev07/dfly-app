import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryRaw = vi.fn();
const deleteMany = vi.fn();

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    rateLimitBucket: { deleteMany: (...args: unknown[]) => deleteMany(...args) },
  },
}));
vi.mock("@/generated/prisma/client", () => ({ Prisma: { sql: () => "RETRY_AFTER_SQL" } }));

/** El módulo guarda la fuente de IP la primera vez: cada test lo carga de nuevo con su entorno. */
async function load(env: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  vi.resetModules();
  return import("./rate-limit");
}

beforeEach(() => {
  queryRaw.mockReset();
  deleteMany.mockReset();
  vi.stubEnv("TRUSTED_PROXY", undefined);
  vi.stubEnv("VERCEL", undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("clientIp", () => {
  it("en Vercel no se deja engañar por un x-forwarded-for inventado", async () => {
    const { clientIp } = await load({ VERCEL: "1", NODE_ENV: "production" });
    const spoofed = new Headers({ "x-forwarded-for": "6.6.6.6", "x-real-ip": "6.6.6.6" });
    expect(clientIp(spoofed)).toBeNull();
    expect(clientIp(new Headers({ "x-vercel-forwarded-for": "203.0.113.7" }))).toBe("203.0.113.7");
  });

  it("respeta TRUSTED_PROXY", async () => {
    const { clientIp } = await load({ TRUSTED_PROXY: "cloudflare", NODE_ENV: "production" });
    expect(clientIp(new Headers({ "cf-connecting-ip": "198.51.100.9" }))).toBe("198.51.100.9");
  });

  it("avisa una sola vez si la configuración no es válida", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { clientIp } = await load({ TRUSTED_PROXY: "x-real-ip", NODE_ENV: "production" });
    const headers = new Headers({ "x-real-ip": "1.2.3.4" });
    expect(clientIp(headers)).toBeNull();
    expect(clientIp(headers)).toBeNull();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain("TRUSTED_PROXY");
  });
});

describe("consumeRateLimit / peekRateLimit", () => {
  it("con IP desconocida deja pasar sin tocar la base de datos", async () => {
    const { consumeRateLimit, peekRateLimit } = await load({ NODE_ENV: "production" });
    await expect(consumeRateLimit("login:ip", null)).resolves.toEqual({ ok: true });
    await expect(peekRateLimit("login:ip", null)).resolves.toEqual({ ok: true });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("con IP conocida cuenta el intento y bloquea al pasar el límite", async () => {
    const { consumeRateLimit } = await load({ VERCEL: "1" });
    queryRaw.mockResolvedValueOnce([{ count: 30, retryAfterSec: 600 }]);
    await expect(consumeRateLimit("login:ip", "203.0.113.7")).resolves.toEqual({ ok: true });
    queryRaw.mockResolvedValueOnce([{ count: 31, retryAfterSec: 900 }]);
    await expect(consumeRateLimit("login:ip", "203.0.113.7")).resolves.toEqual({ ok: false, retryAfterSec: 900 });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });
});

describe("bloqueo del login por email (B3)", () => {
  /** Simula los cubos de Postgres: cada clave cuenta sus intentos. */
  function fakeBuckets() {
    const counts = new Map<string, number>();
    queryRaw.mockImplementation((strings: TemplateStringsArray, key: string) => {
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      return Promise.resolve([{ count, retryAfterSec: 900 }]);
    });
    deleteMany.mockImplementation(({ where }: { where: { key: string } }) => {
      counts.delete(where.key);
      return Promise.resolve({ count: 1 });
    });
  }

  it("un tercero que falla 8 veces desde su IP no bloquea al dueño en la suya", async () => {
    const { consumeRateLimit } = await load({ VERCEL: "1" });
    const { loginEmailKey } = await import("./rate-limit-rules");
    fakeBuckets();
    for (let i = 0; i < 8; i++) await consumeRateLimit("login:email-ip", loginEmailKey("ana@x.com", "6.6.6.6"));
    await expect(consumeRateLimit("login:email-ip", loginEmailKey("ana@x.com", "6.6.6.6"))).resolves.toMatchObject({ ok: false });
    await expect(consumeRateLimit("login:email-ip", loginEmailKey("ana@x.com", "203.0.113.7"))).resolves.toEqual({ ok: true });
  });

  it("clearRateLimit quita el bloqueo", async () => {
    const { clearRateLimit, consumeRateLimit } = await load({ VERCEL: "1" });
    fakeBuckets();
    for (let i = 0; i < 9; i++) await consumeRateLimit("login:email-ip", "ana@x.com");
    await clearRateLimit("login:email-ip", "ana@x.com");
    await expect(consumeRateLimit("login:email-ip", "ana@x.com")).resolves.toEqual({ ok: true });
  });

  it("clearRateLimit sin identificador no toca la base de datos", async () => {
    const { clearRateLimit } = await load({ VERCEL: "1" });
    await clearRateLimit("login:email-ip", null);
    expect(deleteMany).not.toHaveBeenCalled();
  });
});
