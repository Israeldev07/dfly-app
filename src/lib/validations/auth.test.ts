import { describe, expect, it } from "vitest";
import { ecuadorMobileSchema, loginSchema, registerSchema, resetPasswordSchema } from "./auth";

describe("loginSchema", () => {
  it("normaliza el email con espacios y mayúsculas", () => {
    expect(loginSchema.parse({ email: "  User@Mail.COM ", password: "12345678" }).email).toBe("user@mail.com");
  });

  it("rechaza un email inválido", () => {
    expect(loginSchema.safeParse({ email: "user@", password: "12345678" }).success).toBe(false);
  });
});

describe("ecuadorMobileSchema", () => {
  it.each(["0991234567", "099 123 4567", "991234567", "+593991234567", "+593 99-123-4567"])(
    "normaliza %s a E.164",
    (input) => {
      expect(ecuadorMobileSchema.parse(input)).toBe("+593991234567");
    },
  );

  it.each(["062123456", "12345", "+51987654321", "09912345678"])("rechaza %s", (input) => {
    expect(ecuadorMobileSchema.safeParse(input).success).toBe(false);
  });

  it.each(["+51 987 654 321", "+57 300 123 4567", "+1 (912) 345-6789", "+34 912 345 678"])(
    "rechaza el celular extranjero %s diciendo que solo se aceptan de Ecuador",
    (input) => {
      const result = ecuadorMobileSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues[0]?.message).toBe("Solo se aceptan celulares de Ecuador (+593)");
    },
  );

  it("rechaza un fijo de Ecuador con el mensaje de celular inválido", () => {
    const result = ecuadorMobileSchema.safeParse("+593 6 292 0000");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toBe("Ingresa un celular válido (ej. 099 123 4567)");
  });
});

describe("contraseña nueva", () => {
  const base = { name: "Ana", email: "ana@mail.com", phone: "0991234567", whatsappOptIn: "on" };

  it("exige al menos 8 caracteres", () => {
    expect(registerSchema.safeParse({ ...base, password: "1234567" }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, password: "12345678" }).success).toBe(true);
  });

  it("cuenta bytes y no caracteres (bcrypt usa solo 72 bytes)", () => {
    expect(registerSchema.safeParse({ ...base, password: "a".repeat(72) }).success).toBe(true);
    // 40 "ñ" son 40 caracteres pero 80 bytes.
    expect(registerSchema.safeParse({ ...base, password: "ñ".repeat(40) }).success).toBe(false);
  });

  it("al restablecerla, las dos deben coincidir", () => {
    const ok = resetPasswordSchema.safeParse({ token: "t", password: "nueva-clave", confirm: "nueva-clave" });
    expect(ok.success).toBe(true);
    const bad = resetPasswordSchema.safeParse({ token: "t", password: "nueva-clave", confirm: "otra-clave" });
    expect(bad.success).toBe(false);
    expect(bad.error?.issues[0]?.path).toEqual(["confirm"]);
  });
});
