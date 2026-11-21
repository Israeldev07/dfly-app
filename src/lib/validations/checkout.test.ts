import { describe, expect, it } from "vitest";
import { checkoutSchema } from "./checkout";

const base = {
  storeId: "store1",
  addressLine: "Calle Bolívar 123",
  sector: "Centro",
  paymentMethod: "CASH",
  expectedTotalCents: "1000",
};
const parse = (items: unknown[]) => checkoutSchema.safeParse({ ...base, items: JSON.stringify(items) });
const itemsError = (items: unknown[]) => {
  const result = parse(items);
  return result.success ? null : result.error.issues.find((i) => i.path[0] === "items")?.message;
};

describe("checkoutSchema · tope de unidades", () => {
  it("acepta 50 unidades en una línea", () => {
    expect(parse([{ productId: "p1", quantity: 50 }]).success).toBe(true);
  });

  it("rechaza saltarse el tope repitiendo la misma línea", () => {
    expect(itemsError([{ productId: "p1", quantity: 50 }, { productId: "p1", quantity: 1 }])).toBe(
      "Máximo 50 unidades por producto",
    );
  });

  it("trata las mismas opciones en otro orden como la misma línea", () => {
    const items = [
      { productId: "p1", quantity: 30, optionIds: ["a", "b"] },
      { productId: "p1", quantity: 30, optionIds: ["b", "a"] },
    ];
    expect(itemsError(items)).toBe("Máximo 50 unidades por producto");
  });

  it("permite el mismo producto con otras opciones como otra línea", () => {
    const items = [
      { productId: "p1", quantity: 50, optionIds: ["a"] },
      { productId: "p1", quantity: 50, optionIds: ["b"] },
    ];
    expect(parse(items).success).toBe(true);
  });
});
