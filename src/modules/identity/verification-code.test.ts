import { describe, expect, it } from "vitest";
import {
  codeMatches,
  generateCode,
  generateResetToken,
  hashCode,
  hashResetToken,
  isResetTokenShape,
  normalizeCode,
  registrationTicket,
  ticketMatches,
} from "./verification-code";

const SECRET = "secreto-de-prueba";

describe("generateCode", () => {
  it("siempre da 6 dígitos", () => {
    for (let i = 0; i < 200; i++) expect(generateCode()).toMatch(/^\d{6}$/);
  });
});

describe("normalizeCode", () => {
  it("acepta espacios y guiones", () => {
    expect(normalizeCode(" 123 456 ")).toBe("123456");
    expect(normalizeCode("123-456")).toBe("123456");
  });
  it("rechaza si no son 6 dígitos", () => {
    expect(normalizeCode("12345")).toBeNull();
    expect(normalizeCode("1234567")).toBeNull();
    expect(normalizeCode("")).toBeNull();
  });
});

describe("hashCode / codeMatches", () => {
  const hash = hashCode("EMAIL", "u1", "a@b.com", "123456", SECRET);

  it("coincide con el mismo código, usuario, destino y propósito", () => {
    expect(codeMatches(hash, "EMAIL", "u1", "a@b.com", "123456", SECRET)).toBe(true);
  });
  it("no sirve para otro código, usuario, destino, propósito o secreto", () => {
    expect(codeMatches(hash, "EMAIL", "u1", "a@b.com", "654321", SECRET)).toBe(false);
    expect(codeMatches(hash, "EMAIL", "u2", "a@b.com", "123456", SECRET)).toBe(false);
    expect(codeMatches(hash, "EMAIL", "u1", "otro@b.com", "123456", SECRET)).toBe(false);
    expect(codeMatches(hash, "PHONE", "u1", "a@b.com", "123456", SECRET)).toBe(false);
    expect(codeMatches(hash, "EMAIL", "u1", "a@b.com", "123456", "otro")).toBe(false);
  });
  it("no guarda el código en claro", () => {
    expect(hash).not.toContain("123456");
  });
});

describe("tokens de recuperación", () => {
  it("tienen la forma esperada y son distintos", () => {
    const a = generateResetToken();
    const b = generateResetToken();
    expect(isResetTokenShape(a)).toBe(true);
    expect(a).not.toBe(b);
  });
  it("rechaza formas inválidas", () => {
    expect(isResetTokenShape("corto")).toBe(false);
    expect(isResetTokenShape(`${"a".repeat(42)}!`)).toBe(false);
    expect(isResetTokenShape(undefined)).toBe(false);
  });
  it("el hash depende del secreto", () => {
    const t = generateResetToken();
    expect(hashResetToken(t, SECRET)).toBe(hashResetToken(t, SECRET));
    expect(hashResetToken(t, SECRET)).not.toBe(hashResetToken(t, "otro"));
  });
});

describe("ticket del registro", () => {
  it("solo vale para la cuenta y el correo con que se creó", () => {
    const t = registrationTicket("u1", "a@b.com", SECRET);
    expect(ticketMatches(t, "u1", "a@b.com", SECRET)).toBe(true);
    expect(ticketMatches(t, "u2", "a@b.com", SECRET)).toBe(false);
    expect(ticketMatches(t, "u1", "otro@b.com", SECRET)).toBe(false);
  });
  it("tiene la misma forma que uno aleatorio (no delata si la cuenta es nueva)", () => {
    expect(registrationTicket("u1", "a@b.com", SECRET)).toHaveLength(generateResetToken().length);
    expect(ticketMatches(generateResetToken(), "u1", "a@b.com", SECRET)).toBe(false);
  });
});
