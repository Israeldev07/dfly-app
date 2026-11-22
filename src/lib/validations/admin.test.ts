import { describe, expect, it } from "vitest";
import { optionGroupsErrorMessage, optionGroupsSchema } from "./admin";

const option = (id?: string, name = "Papas") => ({ id, name, price: "" });
const group = (id: string | undefined, options: ReturnType<typeof option>[]) => ({
  id,
  name: "Acompañante",
  required: false,
  maxSelect: 1,
  options,
});
const parse = (groups: unknown[]) => optionGroupsSchema.safeParse(JSON.stringify(groups));

describe("optionGroupsSchema", () => {
  it("acepta grupos y opciones con ids distintos, y los nuevos sin id", () => {
    const result = parse([group("g1", [option("o1"), option()]), group(undefined, [option(undefined, "Arroz")])]);
    expect(result.success).toBe(true);
  });

  it("rechaza un grupo repetido", () => {
    const result = parse([group("g1", [option("o1")]), group("g1", [option("o2")])]);
    expect(result.success).toBe(false);
    if (!result.success) expect(optionGroupsErrorMessage(result.error.issues[0])).toBe("Grupo 2: grupo repetido; recarga la página.");
  });

  it("rechaza una opción repetida, también entre grupos", () => {
    const same = parse([group("g1", [option("o1"), option("o1", "Arroz")])]);
    const across = parse([group("g1", [option("o1")]), group("g2", [option("o1")])]);
    expect(same.success).toBe(false);
    expect(across.success).toBe(false);
    if (!across.success) {
      expect(optionGroupsErrorMessage(across.error.issues[0])).toBe("Grupo 2, opción 1: opción repetida; recarga la página.");
    }
  });
});
