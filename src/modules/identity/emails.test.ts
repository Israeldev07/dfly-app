import { describe, expect, it } from "vitest";
import { accountExistsMessage, emailCodeMessage, passwordResetMessage } from "./emails";

describe("correo con el código", () => {
  it("lleva el código y saluda por el primer nombre", () => {
    const m = emailCodeMessage("ana@mail.com", "Ana María Pérez", "123456");
    expect(m.to).toBe("ana@mail.com");
    expect(m.subject).toContain("123456");
    expect(m.text).toContain("Hola Ana,");
    expect(m.html).toContain("123456");
  });

  it("escapa el nombre en el HTML", () => {
    const m = emailCodeMessage("x@mail.com", "<script>", "123456");
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });
});

describe("correo de recuperación", () => {
  it("lleva el enlace y avisa que vence", () => {
    const link = "https://dfly.app/recuperar/nueva?token=abc";
    const m = passwordResetMessage("ana@mail.com", null, link);
    expect(m.text).toContain(link);
    expect(m.text).toContain("Hola,");
    expect(m.text).toContain("30 minutos");
    expect(m.html).toContain('href="https://dfly.app/recuperar/nueva?token=abc"');
  });
});

describe("aviso de cuenta existente", () => {
  it("avisa al dueño y le da el enlace para recuperar el acceso", () => {
    const link = "https://dfly.app/recuperar/nueva?token=xyz";
    const m = accountExistsMessage("ana@mail.com", "Ana", link);
    expect(m.to).toBe("ana@mail.com");
    expect(m.text).toContain("ya tienes una");
    expect(m.text).toContain(link);
    expect(m.html).toContain(`href="${link}"`);
  });
});
