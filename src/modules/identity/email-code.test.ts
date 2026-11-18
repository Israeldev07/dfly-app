import { describe, expect, it } from "vitest";
import { emailCodeMatches, emailCodeMessage, generateEmailCode, hashEmailCode, normalizeEmailCode } from "./email-code";

const SECRET = "test-secret";

describe("código de verificación del email", () => {
  it("genera siempre 6 dígitos", () => {
    for (let i = 0; i < 200; i++) expect(generateEmailCode()).toMatch(/^\d{6}$/);
  });

  it("acepta el código con espacios o guiones y rechaza longitudes incorrectas", () => {
    expect(normalizeEmailCode(" 123 456 ")).toBe("123456");
    expect(normalizeEmailCode("123-456")).toBe("123456");
    expect(normalizeEmailCode("12345")).toBeNull();
    expect(normalizeEmailCode("1234567")).toBeNull();
  });

  it("no guarda el código en claro y lo liga a la cuenta", () => {
    const hash = hashEmailCode("user-1", "123456", SECRET);
    expect(hash).not.toContain("123456");
    expect(emailCodeMatches(hash, "user-1", "123456", SECRET)).toBe(true);
    expect(emailCodeMatches(hash, "user-1", "123457", SECRET)).toBe(false);
    expect(emailCodeMatches(hash, "user-2", "123456", SECRET)).toBe(false);
    expect(emailCodeMatches(hash, "user-1", "123456", "otro-secreto")).toBe(false);
  });

  it("el email lleva el código y escapa el nombre en el HTML", () => {
    const msg = emailCodeMessage("María <b>Cachimuel</b>", "042913");
    expect(msg.subject).toContain("042913");
    expect(msg.text).toContain("042913");
    expect(msg.html).toContain("042913");
    expect(msg.html).not.toContain("<b>");
    expect(emailCodeMessage(null, "042913").text.startsWith("Hola,")).toBe(true);
  });
});
