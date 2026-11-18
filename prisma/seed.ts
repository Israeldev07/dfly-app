import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, StoreCategory } from "../src/generated/prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL }),
});

// Comercios y números FICTICIOS de ejemplo en Otavalo (Imbabura, Ecuador).
// Reemplazar por los reales de cada comercio desde /admin. Precios en centavos de USD.
const stores = [
  {
    slug: "bodega-santa-rosa",
    name: "Bodega Santa Rosa",
    description: "Market de barrio: víveres y esenciales.",
    category: StoreCategory.MARKET,
    city: "Otavalo",
    sector: "Centro",
    etaMinutes: 12,
    whatsappPhone: "+593990000001",
    products: [
      { name: "Leche entera 1 L", priceCents: 105 },
      { name: "Pan de agua (6 und.)", priceCents: 90 },
      { name: "Huevos (cubeta de 30)", priceCents: 480 },
      { name: "Agua sin gas 3 L", priceCents: 125 },
    ],
  },
  {
    slug: "fritadas-el-lago",
    name: "Fritadas El Lago",
    description: "Fritada, hornado y platos típicos de Imbabura.",
    category: StoreCategory.RESTAURANT,
    city: "Otavalo",
    sector: "San Juan",
    etaMinutes: 25,
    whatsappPhone: "+593990000002",
    products: [
      { name: "Fritada completa", priceCents: 650 },
      { name: "Hornado con mote y llapingachos", priceCents: 700 },
      { name: "Empanadas de viento (3 und.)", priceCents: 300 },
      { name: "Jugo de mora", priceCents: 150 },
    ],
  },
  {
    slug: "farmacia-del-valle",
    name: "Farmacia del Valle",
    description: "Medicamentos y cuidado personal.",
    category: StoreCategory.PHARMACY,
    city: "Otavalo",
    sector: "Centro",
    etaMinutes: 18,
    whatsappPhone: "+593990000003",
    products: [
      { name: "Paracetamol 500 mg (10 tab.)", priceCents: 150 },
      { name: "Alcohol antiséptico 250 ml", priceCents: 225 },
      { name: "Protector solar FPS 50", priceCents: 1450 },
    ],
  },
  {
    slug: "licoreria-la-esquina",
    name: "Licorería La Esquina",
    description: "Cervezas, vinos y licores. Solo mayores de 18 años.",
    category: StoreCategory.LIQUOR,
    city: "Otavalo",
    sector: "El Batán",
    etaMinutes: 20,
    whatsappPhone: "+593990000004",
    products: [
      { name: "Cerveza nacional 600 ml", priceCents: 150 },
      { name: "Vino tinto 750 ml", priceCents: 900 },
      { name: "Aguardiente 750 ml", priceCents: 800 },
    ],
  },
  {
    slug: "mascotas-imbabura",
    name: "Mascotas Imbabura",
    description: "Alimento y cuidado para perros y gatos.",
    category: StoreCategory.PETS,
    city: "Otavalo",
    sector: "Centro",
    etaMinutes: 30,
    whatsappPhone: "+593990000005",
    products: [
      { name: "Balanceado para perro adulto 2 kg", priceCents: 850 },
      { name: "Balanceado para gato 1.5 kg", priceCents: 780 },
      { name: "Arena para gato 4 kg", priceCents: 500 },
    ],
  },
];

async function main() {
  for (const { products, ...store } of stores) {
    const saved = await prisma.store.upsert({
      where: { slug: store.slug },
      update: store,
      create: store,
    });
    await prisma.product.deleteMany({ where: { storeId: saved.id, orderItems: { none: {} } } });
    await prisma.product.createMany({
      data: products.map((p) => ({ ...p, storeId: saved.id })),
      skipDuplicates: true,
    });
  }

  await seedAdmin();
  console.log(`Seed OK: ${stores.length} comercios`);
}

/**
 * Crea el usuario ADMIN. El registro no verifica el email, así que una cuenta
 * que ya existe con ese email pudo crearla otra persona: no se asciende salvo
 * que quien ejecuta el seed lo pida con SEED_ADMIN_PROMOTE_EXISTING="true", y
 * en ese caso se reemplaza la contraseña para que nadie conserve la anterior.
 */
async function seedAdmin() {
  // Mismo formato que el login y el registro, que guardan el email en minúsculas.
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return;

  const existing = await prisma.user.findUnique({
    where: { email },
    select: { id: true, role: true },
  });

  if (!existing) {
    await prisma.user.create({
      data: {
        email,
        name: "Admin Dfly",
        role: "ADMIN",
        password: await bcrypt.hash(password, 12),
      },
    });
    console.log(`Admin creado: ${email}`);
    return;
  }

  if (existing.role === "ADMIN") {
    console.log(`Admin ya existente, sin cambios: ${email}`);
    return;
  }

  if (process.env.SEED_ADMIN_PROMOTE_EXISTING !== "true") {
    throw new Error(
      `Ya existe una cuenta con el email ${email} y no es ADMIN. No se asciende ` +
        "porque pudo registrarla otra persona. Si la cuenta es tuya, vuelve a ejecutar " +
        'el seed con SEED_ADMIN_PROMOTE_EXISTING="true": se le dará el rol ADMIN y su ' +
        "contraseña se reemplazará por SEED_ADMIN_PASSWORD.",
    );
  }

  await prisma.user.update({
    where: { id: existing.id },
    data: { role: "ADMIN", password: await bcrypt.hash(password, 12) },
  });
  console.log(`Cuenta existente ascendida a ADMIN con contraseña nueva: ${email}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
