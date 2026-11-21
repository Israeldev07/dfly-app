import "server-only";
import { prisma } from "@/lib/db";
import type { StoreCategory } from "@/generated/prisma/enums";

// Campos públicos de un comercio. `whatsappPhone` NUNCA se selecciona aquí.
const publicStoreSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  category: true,
  city: true,
  sector: true,
  etaMinutes: true,
  imageUrl: true,
} as const;

/** Grupos de opciones de un producto, en el orden en que los dejó el admin. */
export const optionGroupsSelect = {
  orderBy: { position: "asc" },
  select: {
    id: true,
    name: true,
    minSelect: true,
    maxSelect: true,
    options: { orderBy: { position: "asc" }, select: { id: true, name: true, priceDeltaCents: true } },
  },
} as const;

/** Comercios visibles en el listado: activos y con al menos un producto disponible para pedir. */
export async function listStores(category?: StoreCategory) {
  return prisma.store.findMany({
    where: { isActive: true, products: { some: { isAvailable: true } }, ...(category ? { category } : {}) },
    select: publicStoreSelect,
    orderBy: [{ etaMinutes: "asc" }, { name: "asc" }],
  });
}

export async function getStoreWithProducts(slug: string) {
  return prisma.store.findFirst({
    where: { slug, isActive: true },
    select: {
      ...publicStoreSelect,
      products: {
        where: { isAvailable: true },
        select: {
          id: true,
          name: true,
          description: true,
          priceCents: true,
          imageUrl: true,
          optionGroups: optionGroupsSelect,
        },
        orderBy: { name: "asc" },
      },
    },
  });
}

export type PublicStore = Awaited<ReturnType<typeof listStores>>[number];
