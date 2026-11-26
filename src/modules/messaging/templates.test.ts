import { describe, expect, it } from "vitest";
import * as m from "./messages";
import { TEMPLATE_DEFINITIONS, bodyVariables, templateProblems } from "./templates";

const store = { publicCode: "A7K2Q", storeName: "La Casa", items: [{ name: "Pizza", quantity: 1 }], storeNotes: null };
const admin = {
  ...store,
  customerName: "María",
  customerPhone: "+593991234567",
  deliveryAddress: "Bolívar",
  paymentMethod: "CASH" as const,
  totalLabel: "$5.00",
};

/** Un mensaje real de cada plantilla, para comparar sus variables con la definición. */
const samples: m.OutgoingMessage[] = [
  m.adminNewOrderMessage(admin),
  m.storeRequestMessage(store, { accept: "a", reject: "r" }),
  m.adminResultMessage("A7K2Q", "La Casa", true),
  m.customerResultMessage("A7K2Q", "María", "La Casa", true),
  m.customerResultMessage("A7K2Q", "María", "La Casa", false),
  m.adminExpiredMessage("A7K2Q", "La Casa", 5),
  m.customerCancelledMessage("A7K2Q", "María", "La Casa"),
  m.storeCancelledMessage(store),
  m.storeLateResponseMessage(store, "EXPIRED"),
  m.adminLateResponseMessage("A7K2Q", "La Casa", true, "EXPIRED"),
  m.adminCustomerCancelledMessage("A7K2Q", "La Casa"),
  m.adminCancelRequestMessage("A7K2Q", "La Casa", "María", "Error"),
  m.customerCancelRejectedMessage("A7K2Q", "María", "La Casa"),
  m.authCodeMessage("123456"),
  ...m.messageParts(m.storeRequestMessage({ ...store, items: Array(80).fill({ name: "Pizza grande", quantity: 2 }) }, { accept: "a", reject: "r" })).slice(1, 2),
];

describe("plantillas de Meta", () => {
  it("hay una definición por cada plantilla que usa el código", () => {
    const defined = TEMPLATE_DEFINITIONS.map((t) => t.name).sort();
    expect(defined).toEqual(Object.values(m.TEMPLATES).sort());
    expect(new Set(samples.map((s) => s.template))).toEqual(new Set(defined));
  });

  it.each(TEMPLATE_DEFINITIONS)("$name cumple las reglas de Meta", (t) => {
    expect(templateProblems(t)).toEqual([]);
  });

  it.each(samples)("$template recibe tantas variables como define", (s) => {
    const def = TEMPLATE_DEFINITIONS.find((t) => t.name === s.template)!;
    if (def.category === "AUTHENTICATION") return expect(s.otpCode).toBeTruthy();
    expect(s.bodyParams).toHaveLength(bodyVariables(def.body).length);
    expect(s.quickReplies?.length ?? 0).toBe(def.quickReplies?.length ?? 0);
  });
});
