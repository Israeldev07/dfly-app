import { describe, expect, it } from "vitest";
import { clientIpFrom, parseIpSource, resolveIpSource, retryAfterLabel } from "./rate-limit-rules";

const h = (init: Record<string, string>) => new Headers(init);

describe("clientIpFrom", () => {
  it("en Vercel usa x-vercel-forwarded-for e ignora lo que mande el cliente", () => {
    const headers = h({ "x-vercel-forwarded-for": "203.0.113.7", "x-real-ip": "1.1.1.1", "x-forwarded-for": "9.9.9.9" });
    expect(clientIpFrom(headers, { kind: "vercel" })).toBe("203.0.113.7");
    expect(clientIpFrom(h({ "x-forwarded-for": "9.9.9.9" }), { kind: "vercel" })).toBeNull();
  });

  it("con Cloudflare usa cf-connecting-ip", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "2001:db8::1", "x-forwarded-for": "9.9.9.9" }), { kind: "cloudflare" })).toBe(
      "2001:db8::1",
    );
  });

  it("con N proxies propios toma la N-ésima desde la derecha, no la que inventa el cliente", () => {
    // El cliente mandó "6.6.6.6"; nuestro proxy añadió su IP real al final.
    const headers = h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4" });
    expect(clientIpFrom(headers, { kind: "xff", hops: 1 })).toBe("198.51.100.4");
    expect(clientIpFrom(h({ "x-forwarded-for": "6.6.6.6, 198.51.100.4, 10.0.0.2" }), { kind: "xff", hops: 2 })).toBe(
      "198.51.100.4",
    );
    expect(clientIpFrom(h({ "x-forwarded-for": "198.51.100.4" }), { kind: "xff", hops: 2 })).toBeNull();
  });

  it("descarta valores que no parecen IP y no confía en nada con 'none'", () => {
    expect(clientIpFrom(h({ "cf-connecting-ip": "<script>" }), { kind: "cloudflare" })).toBeNull();
    expect(clientIpFrom(h({ "x-forwarded-for": "1.2.3.4" }), { kind: "none" })).toBeNull();
  });
});

describe("parseIpSource", () => {
  it("acepta las opciones documentadas", () => {
    expect(parseIpSource("vercel")).toEqual({ kind: "vercel" });
    expect(parseIpSource(" Cloudflare ")).toEqual({ kind: "cloudflare" });
    expect(parseIpSource("xff:2")).toEqual({ kind: "xff", hops: 2 });
    expect(parseIpSource("none")).toEqual({ kind: "none" });
  });
  it("rechaza el resto", () => {
    for (const v of ["", "xff", "xff:0", "xff:10", "x-real-ip", undefined]) expect(parseIpSource(v)).toBeNull();
  });
});

describe("resolveIpSource", () => {
  it("usa TRUSTED_PROXY si es válido", () => {
    expect(resolveIpSource({ TRUSTED_PROXY: "xff:1", NODE_ENV: "production" })).toEqual({ source: { kind: "xff", hops: 1 } });
  });
  it("con un valor inválido no confía en nada y avisa", () => {
    const r = resolveIpSource({ TRUSTED_PROXY: "x-real-ip", VERCEL: "1" });
    expect(r.source).toEqual({ kind: "none" });
    expect(r.warning).toBeDefined();
  });
  it("detecta Vercel y desarrollo", () => {
    expect(resolveIpSource({ VERCEL: "1", NODE_ENV: "production" }).source).toEqual({ kind: "vercel" });
    expect(resolveIpSource({ NODE_ENV: "development" }).source).toEqual({ kind: "xff", hops: 1 });
  });
  it("en producción fuera de Vercel y sin configurar no adivina", () => {
    const r = resolveIpSource({ NODE_ENV: "production" });
    expect(r.source).toEqual({ kind: "none" });
    expect(r.warning).toContain("TRUSTED_PROXY");
  });
});

describe("retryAfterLabel", () => {
  it("redondea hacia arriba a minutos", () => {
    expect(retryAfterLabel(1)).toBe("1 minuto");
    expect(retryAfterLabel(60)).toBe("1 minuto");
    expect(retryAfterLabel(61)).toBe("2 minutos");
    expect(retryAfterLabel(600)).toBe("10 minutos");
  });
});
