"use server";

import { after } from "next/server";
import { refresh, revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { Prisma } from "@/generated/prisma/client";
import { deleteImage, ImageUploadError, uploadImage, type ImageFolder } from "@/lib/storage";
import {
  idSchema,
  optionGroupsErrorMessage,
  optionGroupsSchema,
  productSchema,
  storeSchema,
  type StoreInput,
} from "@/lib/validations/admin";
import { assertAdmin } from "@/modules/identity/session";
import { dispatchOrderMessages } from "@/modules/ordering/dispatch";
import { cancelOrderByAdmin } from "@/modules/ordering/cancel";
import { rejectCancellationRequest } from "@/modules/ordering/cancel-requests";
import { phoneDigits } from "@/modules/ordering/domain";
import { redirectUnsentStoreRequests } from "@/modules/ordering/store-contact";
import { canRetryMessage, slugify } from "./domain";
import { syncOptionGroups } from "./product-options";

export type AdminFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Record<string, string>;
  /**
   * Adónde navegar tras guardar. Lo hace el formulario en el cliente: con `redirect()` dentro de la
   * acción, el botón se quedaba en "Guardando…" si la navegación se colgaba, aunque ya se hubiera guardado.
   */
  redirectTo?: string;
};

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) out[String(issue.path[0] ?? "form")] ??= issue.message;
  return out;
}

function formValues(formData: FormData) {
  const out: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$")) out[k] = v;
  return out;
}

// ───────────── Pedidos ─────────────

const CANCEL_ERRORS = {
  "not-found": "Este pedido ya no existe.",
  "not-cancellable": "Este pedido ya no se puede cancelar.",
  "changed-meanwhile": "El pedido cambió de estado mientras tanto. Revisa y vuelve a intentar.",
} as const;

export async function cancelOrderAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const orderId = idSchema.safeParse(formData.get("orderId"));
  if (!orderId.success) return { error: "Pedido inválido." };

  const result = await cancelOrderByAdmin(orderId.data);
  if (result !== "cancelled") return { error: CANCEL_ERRORS[result] };

  after(() => dispatchOrderMessages({ orderId: orderId.data }));
  refresh();
  return { ok: true };
}

/** Rechaza la solicitud de cancelación del cliente: el pedido sigue y se le avisa por WhatsApp. */
export async function rejectCancelRequestAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const orderId = idSchema.safeParse(formData.get("orderId"));
  if (!orderId.success) return { error: "Pedido inválido." };

  const result = await rejectCancellationRequest(orderId.data);
  if (result === "not-found") return { error: CANCEL_ERRORS["not-found"] };
  if (result === "already-resolved") {
    refresh();
    return { error: "Esta solicitud ya se resolvió." };
  }
  after(() => dispatchOrderMessages({ orderId: orderId.data }));
  refresh();
  return { ok: true };
}

export async function retryMessageAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const messageId = idSchema.safeParse(formData.get("messageId"));
  if (!messageId.success) return { error: "Mensaje inválido." };

  const msg = await prisma.outboxMessage.findUnique({
    where: { id: messageId.data },
    select: { kind: true, status: true, partsSent: true, orderId: true, order: { select: { status: true } } },
  });
  if (!msg || !canRetryMessage(msg.kind, msg.status, msg.order.status, msg.partsSent)) {
    return { error: "Este mensaje ya no se puede reintentar." };
  }

  // Condicionado a FAILED: si dos admins pulsan a la vez, solo uno lo reencola.
  const { count } = await prisma.outboxMessage.updateMany({
    where: { id: messageId.data, status: "FAILED" },
    data: { status: "PENDING", attempts: 0, nextAttemptAt: new Date(), lastError: null },
  });
  if (count > 0) after(() => dispatchOrderMessages({ orderId: msg.orderId }));
  refresh();
  return { ok: true };
}

// ───────────── Comercios ─────────────

export async function saveStoreAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const values = formValues(formData);
  const parsed = storeSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values };

  const rawStoreId = formData.get("storeId");
  if (typeof rawStoreId === "string" && rawStoreId) {
    const editingId = idSchema.safeParse(rawStoreId);
    if (!editingId.success) return { error: STORE_GONE, values };
    const id = editingId.data;
    const previous = await prisma.store.findUnique({ where: { id }, select: { imageUrl: true, whatsappPhone: true } });
    if (!previous) return { error: STORE_GONE, values };

    const image = await imageFromForm(formData, "stores", previous.imageUrl);
    if ("error" in image) return { fieldErrors: { image: image.error }, values };

    // El slug no cambia al editar: es la URL pública del comercio.
    const phoneChanged = phoneDigits(previous.whatsappPhone) !== phoneDigits(parsed.data.whatsappPhone);
    const saved = await keepingUploadOnSuccess(image, () =>
      prisma.$transaction(async (tx) => {
        await tx.store.update({ where: { id }, data: { ...parsed.data, imageUrl: image.url }, select: { id: true } });
        // Los pedidos que aún no le salieron van al número nuevo; los ya enviados siguen con el que los recibió.
        if (phoneChanged) await redirectUnsentStoreRequests(tx, id, parsed.data.whatsappPhone);
      }),
    );
    if (saved === NOT_FOUND) return { error: STORE_GONE, values };
    if (image.replaced) after(() => deleteImage(image.replaced));
    refresh();
    return { ok: true, values };
  }

  const image = await imageFromForm(formData, "stores", null);
  if ("error" in image) return { fieldErrors: { image: image.error }, values };
  const created = await keepingUploadOnSuccess(image, () => createStoreWithUniqueSlug({ ...parsed.data, imageUrl: image.url }));
  if (created === NOT_FOUND) return { error: "No se pudo crear el comercio. Vuelve a intentar.", values };
  revalidatePath("/admin/comercios");
  return { ok: true, redirectTo: `/admin/comercios/${created.id}?nuevo=1` };
}

const STORE_GONE = "Este comercio ya no existe.";
const PRODUCT_GONE = "Este producto ya no existe.";
const NOT_FOUND = Symbol("not-found");

type FormImage = { url: string | null; replaced: string | null; uploaded: boolean };

/**
 * Lee la foto del formulario (`image`, y `removeImage` para quitarla). Sube la nueva si la hay y
 * devuelve la URL que debe quedar guardada, más la anterior para borrarla tras guardar.
 */
async function imageFromForm(
  formData: FormData,
  folder: ImageFolder,
  current: string | null,
): Promise<FormImage | { error: string }> {
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      return { url: await uploadImage(file, folder), replaced: current, uploaded: true };
    } catch (error) {
      if (error instanceof ImageUploadError) return { error: error.message };
      throw error;
    }
  }
  if (formData.get("removeImage") === "on") return { url: null, replaced: current, uploaded: false };
  return { url: current, replaced: null, uploaded: false };
}

/**
 * Guarda en la BD; si falla, borra la foto recién subida para no dejarla huérfana. Devuelve
 * NOT_FOUND si el registro (P2025) o su comercio (P2003) se borró mientras tanto; cualquier
 * otro error se relanza.
 */
async function keepingUploadOnSuccess<T>(image: FormImage, write: () => Promise<T>): Promise<T | typeof NOT_FOUND> {
  try {
    return await write();
  } catch (error) {
    if (image.uploaded) await deleteImage(image.url);
    if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2025" || error.code === "P2003")) {
      return NOT_FOUND;
    }
    throw error;
  }
}

async function createStoreWithUniqueSlug(data: StoreInput & { imageUrl: string | null }) {
  const base = slugify(data.name) || "comercio";
  for (let n = 1; n <= 20; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    try {
      return await prisma.store.create({ data: { ...data, slug }, select: { id: true } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") continue;
      throw error;
    }
  }
  throw new Error(`No se encontró un slug libre para "${data.name}"`);
}

export async function toggleStoreActiveAction(formData: FormData) {
  await assertAdmin();
  const id = idSchema.safeParse(formData.get("storeId"));
  // updateMany: si el comercio ya no existe no cambia nada (update lanzaría P2025 → 500).
  if (id.success) {
    await prisma.store.updateMany({ where: { id: id.data }, data: { isActive: formData.get("isActive") === "true" } });
  }
  refresh();
}

// ───────────── Productos ─────────────

export async function saveProductAction(_prev: AdminFormState, formData: FormData): Promise<AdminFormState> {
  await assertAdmin();
  const values = formValues(formData);
  const parsed = productSchema.safeParse(values);
  const groups = optionGroupsSchema.safeParse(values.optionGroups);
  if (!parsed.success || !groups.success) {
    const fieldErrors = parsed.success ? {} : fieldErrorsFrom(parsed.error.issues);
    if (!groups.success) fieldErrors.optionGroups = optionGroupsErrorMessage(groups.error.issues[0]!);
    return { fieldErrors, values };
  }
  const { price, ...rest } = parsed.data;
  const data = { ...rest, priceCents: price };

  const productId = formData.get("productId");
  if (typeof productId === "string" && productId) {
    const parsedId = idSchema.safeParse(productId);
    if (!parsedId.success) return { error: PRODUCT_GONE, values };
    const id = parsedId.data;
    const previous = await prisma.product.findUnique({ where: { id }, select: { imageUrl: true } });
    if (!previous) return { error: PRODUCT_GONE, values };
    const image = await imageFromForm(formData, "products", previous.imageUrl);
    if ("error" in image) return { fieldErrors: { image: image.error }, values };

    const product = await keepingUploadOnSuccess(image, () =>
      prisma.$transaction(async (tx) => {
        const saved = await tx.product.update({ where: { id }, data: { ...data, imageUrl: image.url }, select: { storeId: true } });
        await syncOptionGroups(tx, id, groups.data);
        return saved;
      }),
    );
    if (product === NOT_FOUND) return { error: PRODUCT_GONE, values };
    if (image.replaced) after(() => deleteImage(image.replaced));
    return savedProduct(product.storeId);
  }

  const storeId = idSchema.safeParse(formData.get("storeId"));
  if (!storeId.success) return { error: STORE_GONE, values };
  const store = await prisma.store.findUnique({ where: { id: storeId.data }, select: { id: true } });
  if (!store) return { error: STORE_GONE, values };
  const image = await imageFromForm(formData, "products", null);
  if ("error" in image) return { fieldErrors: { image: image.error }, values };

  const created = await keepingUploadOnSuccess(image, () =>
    prisma.$transaction(async (tx) => {
      const saved = await tx.product.create({ data: { ...data, imageUrl: image.url, storeId: store.id }, select: { id: true } });
      await syncOptionGroups(tx, saved.id, groups.data);
    }),
  );
  if (created === NOT_FOUND) return { error: STORE_GONE, values };
  return savedProduct(store.id);
}

function savedProduct(storeId: string): AdminFormState {
  const storePath = `/admin/comercios/${storeId}`;
  // La lista de productos del comercio debe verse ya con el cambio al volver.
  revalidatePath(storePath);
  return { ok: true, redirectTo: storePath };
}

export async function toggleProductAvailableAction(formData: FormData) {
  await assertAdmin();
  const id = idSchema.safeParse(formData.get("productId"));
  if (id.success) {
    await prisma.product.updateMany({ where: { id: id.data }, data: { isAvailable: formData.get("isAvailable") === "true" } });
  }
  refresh();
}
