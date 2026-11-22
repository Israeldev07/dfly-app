"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { cartQuoteSchema, checkoutSchema } from "@/lib/validations/checkout";
import { consumeRateLimit } from "@/lib/rate-limit";
import { retryAfterLabel } from "@/lib/rate-limit-rules";
import { formatUsd } from "@/lib/money";
import { priceSelection, type ProductWithOptions } from "@/modules/catalog/options";
import { optionGroupsSelect } from "@/modules/catalog/queries";
import {
  adminNewOrderMessage,
  exceedsMaxParts,
  sanitizeStoreNotes,
  storeRequestMessage,
} from "@/modules/messaging/messages";
import { buildActionPayload } from "@/modules/messaging/action-payload";
import { adminPhone, enqueue } from "@/modules/messaging/outbox";
import { dispatchOrderMessages } from "./dispatch";
import type { CartQuote } from "./cart-sync";
import { computeTotals, deliveryFeeCents, generatePublicCode } from "./domain";

export type CheckoutState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  /** Lo que escribió el cliente, para no perderlo si hay un error. */
  values?: Record<string, string>;
  /** Precios actuales cuando el carrito quedó desactualizado, para ponerlo al día. */
  quote?: CartQuote;
  /** Envío vigente, por si cambió desde que se abrió la página. */
  deliveryFeeCents?: number;
};

const KEPT_FIELDS = ["addressLine", "sector", "reference", "notes", "paymentMethod"] as const;

/** Productos disponibles (con precio y opciones de la BD) de un comercio activo. */
function availableProducts(storeId: string, productIds: string[]): Promise<ProductWithOptions[]> {
  return prisma.product.findMany({
    where: { storeId, isAvailable: true, store: { isActive: true }, id: { in: productIds } },
    select: { id: true, name: true, priceCents: true, optionGroups: optionGroupsSelect },
  });
}

function toQuote(storeId: string, products: ProductWithOptions[]): CartQuote {
  return { storeId, products };
}

/**
 * Precios y disponibilidad actuales de lo que hay en el carrito. Solo informa al navegador:
 * el cobro se recalcula siempre en `createOrderAction`.
 */
export async function quoteCartAction(input: unknown): Promise<{ quote?: CartQuote }> {
  const session = await auth();
  if (!session?.user?.id) return {};
  const parsed = cartQuoteSchema.safeParse(input);
  if (!parsed.success) return {};
  const { storeId, productIds } = parsed.data;
  return { quote: toQuote(storeId, await availableProducts(storeId, productIds)) };
}

export async function createOrderAction(_prev: CheckoutState, formData: FormData): Promise<CheckoutState> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?callbackUrl=/checkout");
  const userId = session.user.id;

  const raw = Object.fromEntries(formData) as Record<string, string>;
  const values = Object.fromEntries(KEPT_FIELDS.map((k) => [k, typeof raw[k] === "string" ? raw[k] : ""]));
  const parsed = checkoutSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0] ?? "form")] ??= issue.message;
    return { fieldErrors, error: fieldErrors.items ?? fieldErrors.storeId ?? fieldErrors.expectedTotalCents, values };
  }
  const input = parsed.data;

  // Solo se escribe por WhatsApp a un celular que el cliente verificó; nunca al que escriba en el formulario.
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      phone: true,
      phoneVerifiedAt: true,
      emailVerified: true,
    },
  });
  // La cuenta se verifica una sola vez, tras registrarse: el correo y el celular, cada uno con su código.
  if (!user.emailVerified) {
    return { error: "Verifica tu correo antes de hacer tu pedido.", values };
  }
  if (!user.phone || !user.phoneVerifiedAt) {
    return { error: "Verifica tu celular por WhatsApp antes de hacer tu pedido.", values };
  }
  const customerPhone = user.phone;

  const store = await prisma.store.findFirst({
    where: { id: input.storeId, isActive: true },
    select: { id: true, name: true, category: true, city: true, whatsappPhone: true },
  });
  if (!store) return { error: "Este comercio ya no está disponible.", values };

  // Precios SIEMPRE desde la base de datos, nunca desde el navegador.
  const products = await availableProducts(store.id, input.items.map((i) => i.productId));
  const byId = new Map(products.map((p) => [p.id, p]));
  if (input.items.some((i) => !byId.has(i.productId))) {
    return {
      error: "Algunos productos ya no están disponibles. Revisa tu carrito.",
      values,
      quote: toQuote(store.id, products),
    };
  }

  const lines: {
    productId: string;
    nameSnapshot: string;
    optionsSummary: string | null;
    unitPriceCents: number;
    quantity: number;
  }[] = [];
  for (const i of input.items) {
    const product = byId.get(i.productId)!;
    const priced = priceSelection(product, i.optionIds);
    if (!priced.ok) return { error: priced.error, values, quote: toQuote(store.id, products) };
    lines.push({
      productId: product.id,
      nameSnapshot: product.name,
      optionsSummary: priced.summary,
      unitPriceCents: priced.unitPriceCents,
      quantity: i.quantity,
    });
  }
  const fee = deliveryFeeCents();
  const totals = computeTotals(lines, fee);

  // El cliente confirma el total que vio: si los precios cambiaron entre medias, no se cobra otro.
  if (totals.totalCents !== input.expectedTotalCents) {
    return {
      error: "Los precios cambiaron. Revisa tu total antes de confirmar.",
      values,
      quote: toQuote(store.id, products),
      deliveryFeeCents: fee,
    };
  }

  const customerName = user.name?.trim() || user.email;
  const deliveryAddress = [input.addressLine, input.sector, store.city].join(", ") +
    (input.reference ? ` (Ref: ${input.reference})` : "");
  const storeNotes = sanitizeStoreNotes(input.notes);
  const items = lines.map((l) => ({ name: l.nameSnapshot, options: l.optionsSummary, quantity: l.quantity }));
  const buildMessages = (publicCode: string, orderId: string) => ({
    admin: adminNewOrderMessage({
      publicCode,
      storeName: store.name,
      items,
      storeNotes: input.notes,
      customerName,
      customerPhone,
      deliveryAddress,
      paymentMethod: input.paymentMethod,
      totalLabel: formatUsd(totals.totalCents),
    }),
    store: storeRequestMessage(
      { publicCode, storeName: store.name, items, storeNotes },
      { accept: buildActionPayload(orderId, "accept"), reject: buildActionPayload(orderId, "reject") },
    ),
  });

  // Antes de crear nada: un código de muestra tiene el mismo largo y los botones no cuentan en el texto.
  const sample = buildMessages(generatePublicCode(), "muestra");
  if (exceedsMaxParts(sample.admin) || exceedsMaxParts(sample.store)) {
    return {
      error: "Tu pedido es demasiado largo para enviarlo al comercio. Divídelo en dos pedidos o acorta las indicaciones.",
      values,
    };
  }

  // Solo cuenta pedidos válidos: corregir el carrito no gasta cupo.
  const limit = await consumeRateLimit("order:user", userId);
  if (!limit.ok) {
    return { error: `Hiciste varios pedidos seguidos. Podrás hacer otro en ${retryAfterLabel(limit.retryAfterSec)}.`, values };
  }

  let order: { id: string; publicCode: string } | null = null;
  for (let attempt = 0; attempt < 3 && !order; attempt++) {
    const publicCode = generatePublicCode();
    try {
      order = await prisma.$transaction(async (tx) => {
        const created = await tx.order.create({
          data: {
            publicCode,
            userId,
            storeId: store.id,
            status: "PENDING",
            ...totals,
            notes: input.notes,
            paymentMethod: input.paymentMethod,
            customerName,
            customerPhone,
            deliveryAddress,
            items: { create: lines },
            events: { create: { from: null, to: "PENDING", actor: "CUSTOMER" } },
          },
          select: { id: true, publicCode: true },
        });

        await saveDefaultAddress(tx, userId, input.addressLine, input.sector, store.city, input.reference);

        const messages = buildMessages(publicCode, created.id);
        await enqueue(tx, created.id, "ADMIN_NEW_ORDER", adminPhone(), messages.admin);
        await enqueue(tx, created.id, "STORE_REQUEST", store.whatsappPhone, messages.store);
        return created;
      });
    } catch (error) {
      // Choque del código corto (muy improbable): se reintenta con otro.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  if (!order) return { error: "No pudimos registrar tu pedido. Inténtalo de nuevo.", values };

  const orderId = order.id;
  after(() => dispatchOrderMessages({ orderId }));
  redirect(`/pedidos/${order.publicCode}?nuevo=1`);
}

async function saveDefaultAddress(
  tx: Prisma.TransactionClient,
  userId: string,
  line: string,
  sector: string,
  city: string,
  reference: string | null,
) {
  const current = await tx.address.findFirst({ where: { userId, isDefault: true }, select: { id: true } });
  const data = { line, sector, city, reference };
  if (current) await tx.address.update({ where: { id: current.id }, data });
  else await tx.address.create({ data: { ...data, userId, label: "Casa", isDefault: true } });
}
