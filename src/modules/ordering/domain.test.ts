import { describe, expect, it } from "vitest";
import {
  canTransition,
  computeTotals,
  customerCanCancelNow,
  customerCanRequestCancel,
  generatePublicCode,
  lateReplyState,
  storeReplyMustRetry,
} from "./domain";

describe("máquina de estados del pedido", () => {
  it("permite el flujo feliz", () => {
    expect(canTransition("PENDING", "SENT_TO_STORE")).toBe(true);
    expect(canTransition("SENT_TO_STORE", "ACCEPTED")).toBe(true);
    expect(canTransition("SENT_TO_STORE", "REJECTED")).toBe(true);
  });

  it("no permite responder dos veces ni saltarse el envío al comercio", () => {
    expect(canTransition("ACCEPTED", "REJECTED")).toBe(false);
    expect(canTransition("REJECTED", "ACCEPTED")).toBe(false);
    expect(canTransition("PENDING", "ACCEPTED")).toBe(false);
  });

  it("un pedido vencido no se puede aceptar ni rechazar, solo cancelar", () => {
    expect(canTransition("EXPIRED", "ACCEPTED")).toBe(false);
    expect(canTransition("EXPIRED", "REJECTED")).toBe(false);
    expect(canTransition("EXPIRED", "CANCELLED")).toBe(true);
  });
});

describe("cancelación por el cliente", () => {
  it("cancela al instante solo si el comercio aún no aceptó", () => {
    expect(customerCanCancelNow("PENDING")).toBe(true);
    expect(customerCanCancelNow("SENT_TO_STORE")).toBe(true);
    expect(customerCanCancelNow("EXPIRED")).toBe(true);
    expect(customerCanCancelNow("ACCEPTED")).toBe(false);
    expect(customerCanCancelNow("REJECTED")).toBe(false);
    expect(customerCanCancelNow("CANCELLED")).toBe(false);
  });

  it("con el pedido aceptado solo puede solicitarla", () => {
    expect(customerCanRequestCancel("ACCEPTED")).toBe(true);
    for (const s of ["PENDING", "SENT_TO_STORE", "EXPIRED", "REJECTED", "CANCELLED"] as const) {
      expect(customerCanRequestCancel(s)).toBe(false);
    }
  });

  it("todo lo que el cliente puede cancelar es una transición válida a CANCELLED", () => {
    for (const s of ["PENDING", "SENT_TO_STORE", "EXPIRED", "ACCEPTED"] as const) {
      expect(canTransition(s, "CANCELLED")).toBe(true);
    }
  });
});

describe("lateReplyState", () => {
  it("avisa solo si el pedido ya venció o se canceló", () => {
    expect(lateReplyState("EXPIRED")).toBe("EXPIRED");
    expect(lateReplyState("CANCELLED")).toBe("CANCELLED");
  });

  it("ignora la doble pulsación y los estados donde aún no hay respuesta tardía", () => {
    expect(lateReplyState("ACCEPTED")).toBeNull();
    expect(lateReplyState("REJECTED")).toBeNull();
    expect(lateReplyState("PENDING")).toBeNull();
    expect(lateReplyState("SENT_TO_STORE")).toBeNull();
  });
});

describe("storeReplyMustRetry", () => {
  it("reintenta si el pedido le llegó al comercio pero el envío aún no quedó registrado", () => {
    expect(storeReplyMustRetry("PENDING")).toBe(true);
  });

  it("no reintenta respuestas dobles ni tardías", () => {
    for (const status of ["ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"] as const) {
      expect(storeReplyMustRetry(status)).toBe(false);
    }
  });
});

describe("computeTotals", () => {
  it("suma en centavos sin errores de coma flotante", () => {
    const totals = computeTotals(
      [
        { unitPriceCents: 10, quantity: 3 },
        { unitPriceCents: 20, quantity: 1 },
      ],
      150,
    );
    expect(totals).toEqual({ subtotalCents: 50, deliveryFeeCents: 150, totalCents: 200 });
  });
});

describe("generatePublicCode", () => {
  it("genera códigos legibles sin caracteres ambiguos", () => {
    for (let i = 0; i < 200; i++) {
      expect(generatePublicCode()).toMatch(/^[2-9A-HJKMNP-Z]{5}$/);
    }
  });
});
