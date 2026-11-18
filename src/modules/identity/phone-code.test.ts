import { describe, expect, it } from "vitest";
import { findPhoneCodes, generatePhoneCode, samePhone, verificationLink, verificationText } from "./phone-code";

describe("código de verificación del celular", () => {
  it("genera códigos de 6 caracteres sin caracteres ambiguos", () => {
    for (let i = 0; i < 200; i++) expect(generatePhoneCode()).toMatch(/^[2-9A-HJKMNP-Z]{6}$/);
  });

  it("encuentra el código en el mensaje precargado", () => {
    expect(findPhoneCodes(verificationText("K7P4QX"))).toEqual(["K7P4QX"]);
  });

  it("lo encuentra aunque el cliente lo escriba en minúsculas o con otro texto", () => {
    expect(findPhoneCodes("hola, mi código es k7p4qx gracias")).toEqual(["K7P4QX"]);
  });

  it("no confunde palabras normales ni partes de palabras con un código", () => {
    expect(findPhoneCodes("Verificar Dfly")).toEqual([]);
    expect(findPhoneCodes("ABCDEFGH")).toEqual([]);
    expect(findPhoneCodes("pedido A7K3P")).toEqual([]);
  });

  it("arma el enlace de WhatsApp con el número de Dfly y el mensaje listo", () => {
    expect(verificationLink("+593 99 000 0000", "K7P4QX")).toBe(
      "https://wa.me/593990000000?text=Verificar%20Dfly%3A%20K7P4QX",
    );
  });

  it("compara números ignorando el formato", () => {
    expect(samePhone("+593991234567", "593991234567")).toBe(true);
    expect(samePhone("+593991234567", "593991234568")).toBe(false);
  });
});
