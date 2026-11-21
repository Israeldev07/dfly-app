import { describe, expect, it } from "vitest";
import { ecuadorMobileSchema } from "@/lib/validations/auth";
import { extractButtonTaps } from "@/modules/messaging/webhook";
import {
  canTransition,
  computeTotals,
  customerCanCancelNow,
  customerCanRequestCancel,
  generatePublicCode,
  isStoreSender,
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

describe("remitente de la respuesta del comercio", () => {
  it("acepta el número al que salió el pedido, con o sin + (el wa_id de Meta no lo trae)", () => {
    expect(isStoreSender("593991234567", ["+593991234567"])).toBe(true);
  });

  it("acepta cualquiera de los números a los que salió el pedido", () => {
    expect(isStoreSender("593992222222", ["+593991111111", "+593992222222"])).toBe(true);
  });

  it("rechaza un número al que no salió el pedido (p. ej. el nuevo del comercio)", () => {
    expect(isStoreSender("593992222222", ["+593991111111"])).toBe(false);
  });

  it("rechaza si el pedido no salió a ningún número o el remitente está vacío", () => {
    expect(isStoreSender("593991111111", [])).toBe(false);
    expect(isStoreSender("", [""])).toBe(false);
  });
});

describe("remitente con un webhook real de Meta", () => {
  // Cuerpo tal como lo envía Meta al pulsar un botón de plantilla: `from` y `wa_id` llevan el
  // número en dígitos, con código de país y sin "+".
  const metaWebhook = (from: string) => ({
    object: "whatsapp_business_account",
    entry: [
      {
        id: "102290129340398",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "593987654321", phone_number_id: "106540352242922" },
              contacts: [{ profile: { name: "Alitas Terra Nova" }, wa_id: from }],
              messages: [
                {
                  context: { from: "593987654321", id: "wamid.HBgMNTkzOTg3NjU0MzIxFQIAERgSQ1RYAA==" },
                  from,
                  id: "wamid.HBgMNTkzOTkxMjM0NTY3FQIAEhgUM0VCMDRBQUI2NjZBQjVDRDQ5QzMA",
                  timestamp: "1763650000",
                  type: "button",
                  button: { payload: "o:abc:a:firma", text: "Aceptar" },
                },
              ],
            },
          },
        ],
      },
    ],
  });

  // Como lo escribe el admin en /admin ("099 123 4567") y lo guarda ecuadorMobileSchema.
  const stored = ecuadorMobileSchema.parse("099 123 4567");

  it("reconoce el número del comercio guardado desde /admin", () => {
    expect(stored).toBe("+593991234567");
    const [tap] = extractButtonTaps(metaWebhook("593991234567"), "106540352242922");
    expect(tap?.from).toBe("593991234567");
    expect(isStoreSender(tap!.from, [stored])).toBe(true);
  });

  it("no reconoce a otro número que pulse un botón reenviado", () => {
    const [tap] = extractButtonTaps(metaWebhook("593998887777"), "106540352242922");
    expect(isStoreSender(tap!.from, [stored])).toBe(false);
  });
});
