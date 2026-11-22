import type { StoreCategory } from "@/generated/prisma/enums";

/**
 * `image`: foto de la portada de la categoría en `/comercios?categoria=…`; el archivo va
 * en `public/categorias/<slug>.jpg` (cuadrada, producto sobre fondo blanco).
 */
export const CATEGORIES: { slug: string; label: string; value: StoreCategory; image: string }[] = [
  { slug: "restaurantes", label: "Restaurantes", value: "RESTAURANT", image: "/categorias/restaurantes.jpg" },
  { slug: "market", label: "Market", value: "MARKET", image: "/categorias/market.jpg" },
  { slug: "farmacia", label: "Farmacia", value: "PHARMACY", image: "/categorias/farmacia.jpg" },
  { slug: "bebidas", label: "Bebidas", value: "LIQUOR", image: "/categorias/bebidas.jpg" },
  { slug: "mascotas", label: "Mascotas", value: "PETS", image: "/categorias/mascotas.jpg" },
];

export function categoryFromSlug(slug: string | undefined) {
  return CATEGORIES.find((c) => c.slug === slug);
}

export function categoryLabel(value: StoreCategory) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

export function categorySlug(value: StoreCategory) {
  return CATEGORIES.find((c) => c.value === value)?.slug ?? "";
}
