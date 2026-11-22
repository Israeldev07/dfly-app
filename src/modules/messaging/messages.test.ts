import { describe, expect, it } from "vitest";
import {
  authCodeMessage,
  adminCancelRequestMessage,
  adminCustomerCancelledMessage,
  customerCancelRejectedMessage,
  adminLateResponseMessage,
  adminNewOrderMessage,
  customerCancelledMessage,
  exceedsMaxParts,
  messageParts,
  packLines,
  TEMPLATE_BODY_LIMIT,
  TEMPLATE_FIXED_TEXT_MAX,
  sanitizeStoreNotes,
  storeCancelledMessage,
  storeLateResponseMessage,
  storeRequestMessage,
  toParam,
  type AdminOrderView,
} from "./messages";

const order: AdminOrderView = {
  publicCode: "A7K3P",
  storeName: "Fritadas El Lago",
  items: [
    { name: "Fritada completa", quantity: 2 },
    { name: "Jugo de mora", quantity: 1, options: "Tamaño: Grande" },
  ],
  storeNotes: "Sin cebolla, por favor",
  customerName: "María Cachimuel",
  customerPhone: "+593991234567",
  deliveryAddress: "Calle Bolívar 5-12, Centro, Otavalo (junto a la panadería)",
  paymentMethod: "CASH",
  totalLabel: "$15,50",
};

describe("privacidad del mensaje al comercio", () => {
  it("NUNCA incluye nombre, teléfono ni dirección del cliente", () => {
    // Aunque por error se le pase la vista completa, el builder solo usa los campos del comercio.
    const msg = storeRequestMessage(order, { accept: "A", reject: "R" });
    const everything = JSON.stringify(msg);
    expect(everything).not.toContain("María");
    expect(everything).not.toContain("Cachimuel");
    expect(everything).not.toContain("991234567");
    expect(everything).not.toContain("Bolívar");
    expect(everything).toContain("2 x Fritada completa");
    expect(everything).toContain("1 x Jugo de mora (Tamaño: Grande)");
    expect(msg.quickReplies).toEqual(["A", "R"]);
  });

  it("el dueño sí recibe todos los datos", () => {
    const text = JSON.stringify(adminNewOrderMessage(order));
    expect(text).toContain("María Cachimuel");
    expect(text).toContain("+593991234567");
    expect(text).toContain("Calle Bolívar");
  });
});

describe("sanitizeStoreNotes", () => {
  it("oculta teléfonos, correos y enlaces escritos por el cliente", () => {
    expect(sanitizeStoreNotes("Llamar al 099 123 4567 al llegar")).toBe("Llamar al [dato oculto] al llegar");
    expect(sanitizeStoreNotes("mi correo maria@mail.com")).toBe("mi correo [dato oculto]");
    expect(sanitizeStoreNotes("ver https://wa.me/593991234567")).toBe("ver [dato oculto]");
    expect(sanitizeStoreNotes("Sin ají, 2 servilletas")).toBe("Sin ají, 2 servilletas");
    expect(sanitizeStoreNotes("   ")).toBeNull();
  });
});

describe("toParam", () => {
  it("elimina saltos de línea y espacios repetidos que Meta rechaza", () => {
    expect(toParam("línea 1\nlínea 2\t\tfin     ok")).toBe("línea 1 / línea 2 / fin ok");
    expect(toParam("   ")).toBe("-");
  });
});

describe("avisos de respuesta tardía", () => {
  it("el comercio solo recibe código, su nombre y el estado", () => {
    const msg = storeLateResponseMessage(order, "EXPIRED");
    const everything = JSON.stringify(msg);
    expect(everything).not.toContain("María");
    expect(everything).not.toContain("991234567");
    expect(everything).not.toContain("Bolívar");
    expect(msg.bodyParams).toEqual(["A7K3P", "Fritadas El Lago", "VENCIDO"]);
    expect(msg.quickReplies).toBeUndefined();
    expect(storeLateResponseMessage(order, "CANCELLED").bodyParams[2]).toBe("CANCELADO");
  });

  it("el dueño sabe qué pulsó el comercio y en qué estado estaba el pedido", () => {
    expect(adminLateResponseMessage("A7K3P", "Fritadas El Lago", true, "EXPIRED").bodyParams).toEqual([
      "A7K3P",
      "Fritadas El Lago",
      "ACEPTAR",
      "vencido",
    ]);
    expect(adminLateResponseMessage("A7K3P", "Fritadas El Lago", false, "CANCELLED").bodyParams.slice(2)).toEqual([
      "RECHAZAR",
      "cancelado",
    ]);
  });
});

describe("cancelación por el cliente", () => {
  it("el dueño recibe el código, el comercio, el cliente y el motivo saneado", () => {
    const msg = adminCancelRequestMessage("A7K3P", "Fritadas El Lago", "María Cachimuel", "Me equivoqué\nde dirección.");
    expect(msg.bodyParams).toEqual(["A7K3P", "Fritadas El Lago", "María Cachimuel", "Me equivoqué / de dirección"]);
    expect(msg.preview).not.toContain("..");
  });

  it("aviso al dueño cuando el cliente cancela al instante", () => {
    expect(adminCustomerCancelledMessage("A7K3P", "Fritadas El Lago").bodyParams).toEqual(["A7K3P", "Fritadas El Lago"]);
  });

  it("el cliente sabe que su solicitud no se aprobó", () => {
    expect(customerCancelRejectedMessage("A7K3P", "María", "Fritadas El Lago").bodyParams).toEqual([
      "María",
      "A7K3P",
      "Fritadas El Lago",
    ]);
  });
});

describe("avisos de cancelación", () => {
  it("el comercio solo recibe código y su nombre", () => {
    // Aunque se le pase la vista completa, el builder ignora los datos del cliente.
    const msg = storeCancelledMessage(order);
    const everything = JSON.stringify(msg);
    expect(everything).not.toContain("María");
    expect(everything).not.toContain("991234567");
    expect(everything).not.toContain("Bolívar");
    expect(msg.bodyParams).toEqual(["A7K3P", "Fritadas El Lago"]);
  });

  it("el cliente recibe su nombre, código y comercio", () => {
    expect(customerCancelledMessage("A7K3P", "María", "Fritadas El Lago").bodyParams).toEqual([
      "María",
      "A7K3P",
      "Fritadas El Lago",
    ]);
  });
});

describe("pedidos largos en varios mensajes", () => {
  const BUDGET = TEMPLATE_BODY_LIMIT - TEMPLATE_FIXED_TEXT_MAX;
  const payloads = { accept: "acc", reject: "rej" };
  const bigItems = Array.from({ length: 40 }, (_, i) => ({
    name: `Producto número ${i + 1} con nombre bastante largo para la prueba`,
    quantity: 2,
    options: "Acompañante: Yuca · Agrega: Arroz, Huevo frito",
  }));
  const big: AdminOrderView = {
    ...order,
    items: bigItems,
    storeNotes: "x".repeat(300),
    customerName: `${"cliente".repeat(30)}@correo.com`,
    deliveryAddress: `${"a".repeat(160)}, ${"b".repeat(60)}, Otavalo (Ref: ${"c".repeat(160)})`,
  };
  const allText = (msg: ReturnType<typeof storeRequestMessage>) =>
    messageParts(msg).flatMap((p) => p.bodyParams).join(" ");

  it("un pedido normal sigue siendo un solo mensaje", () => {
    expect(storeRequestMessage(order, payloads).continuation).toBeUndefined();
    expect(adminNewOrderMessage(order).continuation).toBeUndefined();
  });

  it("ningún mensaje supera el límite de Meta y no se pierde ningún producto", () => {
    for (const msg of [storeRequestMessage(big, payloads), adminNewOrderMessage(big)]) {
      const parts = messageParts(msg);
      expect(parts.length).toBeGreaterThan(1);
      for (const part of parts) {
        expect(part.bodyParams.reduce((n, p) => n + p.length, 0)).toBeLessThanOrEqual(BUDGET);
      }
      for (const item of bigItems) expect(allText(msg)).toContain(`2 x ${item.name}`);
    }
  });

  it("los botones van solo en el primer mensaje y las partes están numeradas", () => {
    const [first, ...rest] = messageParts(storeRequestMessage(big, payloads));
    expect(first.quickReplies).toEqual(["acc", "rej"]);
    expect(first.bodyParams[1]).toMatch(/\(sigue en el próximo mensaje\)$/);
    rest.forEach((part, k) => {
      expect(part.template).toBe("pedido_detalle_parte");
      expect(part.quickReplies).toBeUndefined();
      expect(part.bodyParams[0]).toBe("A7K3P");
      expect(part.bodyParams[1]).toBe(`${k + 2}/${rest.length + 1}`);
    });
  });

  it("al dueño le llegan completas la dirección y las indicaciones aunque no quepan en el principal", () => {
    const msg = adminNewOrderMessage(big);
    expect(msg.bodyParams[5]).toBe(big.customerName);
    expect(allText(msg)).toContain(big.deliveryAddress);
    expect(allText(msg)).toContain("x".repeat(300));
  });

  it("las continuaciones al comercio tampoco llevan datos del cliente", () => {
    const text = allText(storeRequestMessage(big, payloads));
    expect(text).not.toContain("cliente");
    expect(text).not.toContain("Otavalo");
    expect(text).not.toContain("+593");
  });

  it("un pedido enorme excede las continuaciones admitidas", () => {
    const huge = { ...big, items: bigItems.map((i) => ({ ...i, options: "Extra: ".concat("queso ".repeat(150)) })) };
    expect(exceedsMaxParts(storeRequestMessage(huge, payloads))).toBe(true);
    expect(exceedsMaxParts(storeRequestMessage(big, payloads))).toBe(false);
  });
});

describe("packLines", () => {
  it("agrupa líneas sin pasarse del presupuesto", () => {
    expect(packLines(["aaa", "bbb", "ccc"], 8, 8)).toEqual(["aaa, bbb", "ccc"]);
  });

  it("corta una línea demasiado larga en un espacio sin perder texto", () => {
    const line = "uno dos tres cuatro cinco seis";
    const chunks = packLines([line], 10, 10);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(10);
    expect(chunks.join(" ")).toBe(line);
  });
});

describe("código de verificación del celular", () => {
  it("usa la plantilla de autenticación con el código en el cuerpo y en el botón", () => {
    const m = authCodeMessage("482913");
    expect(m.template).toBe("codigo_verificacion");
    expect(m.bodyParams).toEqual(["482913"]);
    expect(m.otpCode).toBe("482913");
    expect(m.quickReplies).toBeUndefined();
  });
});
