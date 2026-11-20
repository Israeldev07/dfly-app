import { describe, expect, it } from "vitest";
import { clearSessionUrl, hasSessionCookie } from "./session-cookie";

describe("hasSessionCookie", () => {
  it("reconoce la cookie de sesión, con prefijo seguro y partida", () => {
    expect(hasSessionCookie(["authjs.session-token"])).toBe(true);
    expect(hasSessionCookie(["__Secure-authjs.session-token"])).toBe(true);
    expect(hasSessionCookie(["otra", "authjs.session-token.0", "authjs.session-token.1"])).toBe(true);
  });

  it("ignora las demás cookies de Auth.js y las ajenas", () => {
    expect(hasSessionCookie([])).toBe(false);
    expect(hasSessionCookie(["authjs.csrf-token", "authjs.callback-url", "dfly-cart"])).toBe(false);
    expect(hasSessionCookie(["xauthjs.session-token", "authjs.session-token-x"])).toBe(false);
  });
});

describe("clearSessionUrl", () => {
  it("codifica el destino", () => {
    expect(clearSessionUrl("/pedidos/ABC?x=1")).toBe("/api/sesion/limpiar?callbackUrl=%2Fpedidos%2FABC%3Fx%3D1");
  });
});
