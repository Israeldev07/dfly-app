import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, StoreCategory } from "../src/generated/prisma/client";
import { pendingStores, storesWithMenu, type CatalogStore } from "./data/catalogo-otavalo";

// Importa el catálogo real (prisma/data/catalogo-otavalo.ts). Se puede correr varias veces:
// - Comercio por slug: lo crea si no existe. Si ya existe no lo toca (nombre, descripción y
//   WhatsApp se corrigen en /admin); solo avisa si su WhatsApp difiere del catálogo.
// - Producto por nombre dentro del comercio: crea los nuevos; en los existentes actualiza el
//   precio (y avisa del cambio) y la descripción solo si el catálogo trae una.
//   Nunca borra: lo que se quite del catálogo se marca agotado a mano desde /admin.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

const DEFAULTS = { category: StoreCategory.RESTAURANT, city: "Otavalo", sector: "Otavalo", etaMinutes: 30 };

async function importStore(store: CatalogStore) {
  const { products, ...fields } = store;
  let saved = await prisma.store.findUnique({
    where: { slug: store.slug },
    select: { id: true, whatsappPhone: true },
  });
  if (!saved) {
    saved = await prisma.store.create({
      data: { ...DEFAULTS, ...fields },
      select: { id: true, whatsappPhone: true },
    });
  } else if (saved.whatsappPhone !== fields.whatsappPhone) {
    console.warn(
      `  ${store.name}: el WhatsApp en la BD (${saved.whatsappPhone}) difiere del catálogo ` +
        `(${fields.whatsappPhone}); se conserva el de la BD. Cámbialo en /admin si hace falta.`,
    );
  }

  const existing = await prisma.product.findMany({
    where: { storeId: saved.id },
    select: { id: true, name: true, priceCents: true },
  });
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));
  let created = 0;
  let updated = 0;
  for (const p of products) {
    const current = byName.get(p.name.toLowerCase());
    if (current) {
      if (current.priceCents !== p.priceCents) {
        console.log(`  ${store.name} · ${current.name}: precio ${current.priceCents} → ${p.priceCents} centavos`);
      }
      await prisma.product.update({
        where: { id: current.id },
        // Sin descripción en el catálogo se conserva la de la BD (pudo escribirse en /admin).
        data: { priceCents: p.priceCents, ...(p.description ? { description: p.description } : {}) },
        select: { id: true },
      });
      updated++;
    } else {
      await prisma.product.create({
        data: { name: p.name, description: p.description ?? null, priceCents: p.priceCents, storeId: saved.id },
        select: { id: true },
      });
      created++;
    }
  }
  return { created, updated };
}

async function main() {
  for (const store of storesWithMenu) {
    const { created, updated } = await importStore(store);
    console.log(`${store.name}: ${created} productos nuevos, ${updated} actualizados`);
  }
  console.log(`Catálogo OK: ${storesWithMenu.length} comercios.`);
  console.log(`Pendientes de WhatsApp (no importados): ${pendingStores.map((s) => s.name).join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
