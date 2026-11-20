import { describe, expect, it } from "vitest";
import { displayPhone, isSessionCurrent, passwordResetUpdate, samePhone, verificationStatus } from "./account-rules";

describe("celular", () => {
  it("compara solo los dígitos", () => {
    expect(samePhone("+593 99 123 4567", "+593991234567")).toBe(true);
    expect(samePhone("+593991234567", "+593991234568")).toBe(false);
  });
  it("muestra el número en formato local", () => {
    expect(displayPhone("+593991234567")).toBe("099 123 4567");
    expect(displayPhone("0991234567")).toBe("099 123 4567");
  });
});

describe("vigencia de la sesión", () => {
  const cutoff = new Date("2026-11-19T12:00:00Z");
  it("sin corte, toda sesión vale", () => {
    expect(isSessionCurrent(undefined, null)).toBe(true);
    expect(isSessionCurrent(1, null)).toBe(true);
  });
  it("una sesión anterior al corte no vale", () => {
    expect(isSessionCurrent(cutoff.getTime() - 1, cutoff)).toBe(false);
    expect(isSessionCurrent(undefined, cutoff)).toBe(false);
  });
  it("una sesión iniciada en el corte o después vale", () => {
    expect(isSessionCurrent(cutoff.getTime(), cutoff)).toBe(true);
    expect(isSessionCurrent(cutoff.getTime() + 1000, cutoff)).toBe(true);
  });
});

describe("verificación de la cuenta", () => {
  const now = new Date();
  it("exige correo y celular", () => {
    expect(verificationStatus({ emailVerified: now, phone: "+593991234567", phoneVerifiedAt: now }).complete).toBe(true);
    expect(verificationStatus({ emailVerified: null, phone: "+593991234567", phoneVerifiedAt: now })).toEqual({
      email: false,
      phone: true,
      complete: false,
    });
    expect(verificationStatus({ emailVerified: now, phone: null, phoneVerifiedAt: now }).phone).toBe(false);
    expect(verificationStatus({ emailVerified: now, phone: "+593991234567", phoneVerifiedAt: null }).complete).toBe(false);
  });
});

describe("passwordResetUpdate", () => {
  const now = new Date("2026-11-20T12:00:00Z");

  it("con el correo ya verificado solo anula las sesiones", () => {
    expect(passwordResetUpdate(new Date("2026-01-01"), now)).toEqual({ sessionsValidFrom: now, unproven: false });
  });

  it("con el correo sin verificar borra lo que fijó quien creó la cuenta (B6)", () => {
    // Un intruso se registró con el correo ajeno y verificó SU celular: la dueña no debe heredarlo.
    expect(passwordResetUpdate(null, now)).toEqual({
      sessionsValidFrom: now,
      unproven: true,
      emailVerified: now,
      name: null,
      phone: null,
      phoneVerifiedAt: null,
      whatsappOptInAt: null,
    });
  });

  it("tras limpiarla, la cuenta pide verificar el celular otra vez", () => {
    const update = passwordResetUpdate(null, now);
    if (!update.unproven) throw new Error("debía limpiar la cuenta");
    expect(verificationStatus(update)).toEqual({ email: true, phone: false, complete: false });
  });
});
