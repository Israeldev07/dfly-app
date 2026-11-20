/**
 * Mensajes de WhatsApp de Dfly. Cada mensaje es una plantilla aprobada por Meta
 * (Business-initiated) con parámetros de cuerpo y, opcionalmente, botones quick reply.
 *
 * PRIVACIDAD: el mensaje al comercio se construye SOLO desde `StoreOrderView`,
 * un tipo que no tiene nombre, teléfono ni dirección del cliente.
 */

/** `options`: acompañantes y extras elegidos (los define el admin, no el cliente). */
export type LineView = { name: string; quantity: number; options?: string | null };

/** Lo único que ve el comercio. No añadir campos del cliente aquí. */
export type StoreOrderView = {
  publicCode: string;
  storeName: string;
  items: LineView[];
  storeNotes: string | null;
};

/** Vista completa, solo para el dueño de Dfly. */
export type AdminOrderView = StoreOrderView & {
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  paymentMethod: "CASH" | "TRANSFER";
  totalLabel: string;
};

/** Un mensaje de WhatsApp: una plantilla con sus variables. */
export type TemplateMessage = {
  template: string;
  language: string;
  bodyParams: string[];
  /** Payloads de los botones quick reply, en el orden definido en la plantilla. */
  quickReplies?: string[];
  /** Plantillas de autenticación: el código del botón "Copiar código" (botón tipo URL, índice 0). */
  otpCode?: string;
  /** Texto legible para logs, panel admin y el transporte de desarrollo. */
  preview: string;
};

/**
 * Lo que se encola. `continuation`: mensajes que salen después del principal, en orden, cuando
 * el pedido no cabe en una sola plantilla. El outbox los trata como un único envío.
 */
export type OutgoingMessage = TemplateMessage & { continuation?: TemplateMessage[] };

export const TEMPLATES = {
  adminNewOrder: "nuevo_pedido_admin",
  storeRequest: "pedido_restaurante",
  adminResult: "resultado_pedido_admin",
  customerAccepted: "pedido_confirmado_cliente",
  customerRejected: "pedido_rechazado_cliente",
  adminExpired: "pedido_sin_respuesta_admin",
  customerCancelled: "pedido_cancelado_cliente",
  storeCancelled: "pedido_cancelado_comercio",
  storeLate: "pedido_vencido_comercio",
  adminLate: "respuesta_tardia_admin",
  adminCustomerCancelled: "pedido_cancelado_por_cliente_admin",
  adminCancelRequest: "solicitud_cancelacion_admin",
  customerCancelRejected: "cancelacion_rechazada_cliente",
  /** Continuación de un pedido largo (al comercio o al dueño). Variables: código, "2/3", detalle. */
  orderDetailPart: "pedido_detalle_parte",
  /**
   * Código para verificar el celular. Plantilla de categoría AUTHENTICATION (la única que Meta permite
   * para códigos), con botón "Copiar código". Variable: el código.
   */
  authCode: "codigo_verificacion",
} as const;

const LANG = "es";

/** Meta rechaza el envío (error 132005) si el cuerpo, ya con las variables, supera 1024 caracteres. */
export const TEMPLATE_BODY_LIMIT = 1024;
/** Tope para el texto fijo de las plantillas de pedido en Meta; el resto queda para las variables. */
export const TEMPLATE_FIXED_TEXT_MAX = 200;
const PARAMS_BUDGET = TEMPLATE_BODY_LIMIT - TEMPLATE_FIXED_TEXT_MAX;
/**
 * Más continuaciones que esto no se aceptan: el checkout pide dividir el pedido. Alcanza para un carrito
 * de 40 líneas (el máximo del checkout) con acompañantes; solo lo superan opciones desmesuradas.
 */
export const MAX_CONTINUATION_PARTS = 9;
/** Espacio mínimo para productos en el mensaje principal antes de mover otros campos a la continuación. */
const ITEMS_MIN_ROOM = 150;
const CONTINUES = " (sigue en el próximo mensaje)";
const MOVED = "En el próximo mensaje";

/** Meta no admite saltos de línea, tabulaciones ni más de 4 espacios seguidos en parámetros. */
function cleanParam(value: string) {
  return value.replace(/[\r\n\t]+/g, " / ").replace(/ {2,}/g, " ").trim();
}

export function toParam(value: string) {
  return cleanParam(value).slice(0, 1000) || "-";
}

const totalLength = (params: string[]) => params.reduce((sum, p) => sum + p.length, 0);

/**
 * Reparte las líneas en bloques de como mucho `firstBudget` (el primero) y `restBudget` caracteres,
 * unidas con ", ". Nunca pierde texto: una línea que no cabe sola se corta, si se puede, en un espacio.
 */
export function packLines(lines: string[], firstBudget: number, restBudget: number): string[] {
  const chunks: string[] = [];
  let current = "";
  const budget = () => Math.max(1, chunks.length === 0 ? firstBudget : restBudget);
  for (const line of lines) {
    let rest = line;
    while (rest) {
      const sep = current ? ", " : "";
      if (current.length + sep.length + rest.length <= budget()) {
        current += sep + rest;
        rest = "";
      } else if (current) {
        chunks.push(current);
        current = "";
      } else {
        const max = budget();
        const space = rest.lastIndexOf(" ", max);
        const at = space > 0 ? space : max;
        chunks.push(rest.slice(0, at).trimEnd());
        rest = rest.slice(at).trimStart();
      }
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

type MovableField = { index: number; label: string };

/**
 * Arma el cuerpo de un mensaje de pedido (`params[0]` es el código y `itemsIndex` la lista de productos).
 * Si no cabe en el límite de Meta, la lista sigue en mensajes de continuación y, si aun así no queda
 * sitio para productos, también los campos `movable` (en orden). Nada se trunca.
 */
function fitOrderBody(params: string[], itemsIndex: number, lines: string[], movable: MovableField[]) {
  const body = params.map(toParam);
  const cleanLines = lines.map(cleanParam).filter(Boolean);
  const fullItems = cleanLines.join(", ") || "-";
  body[itemsIndex] = fullItems;
  if (totalLength(body) <= PARAMS_BUDGET) return { body, continuation: [] as TemplateMessage[] };

  const code = body[0];
  const room = () => PARAMS_BUDGET - (totalLength(body) - body[itemsIndex].length) - CONTINUES.length;
  const moved: string[] = [];
  for (const field of movable) {
    if (room() >= ITEMS_MIN_ROOM) break;
    moved.push(`${field.label}: ${body[field.index]}`);
    body[field.index] = MOVED;
  }

  const partRoom = PARAMS_BUDGET - code.length - "99/99".length;
  const [first = "", ...restItems] = packLines(cleanLines, room(), partRoom);
  const parts = packLines([...restItems, ...moved], partRoom, partRoom);
  body[itemsIndex] = parts.length > 0 ? `${first}${CONTINUES}` : first || "-";

  const total = parts.length + 1;
  const continuation = parts.map((text, k): TemplateMessage => {
    const partParams = [code, `${k + 2}/${total}`, text];
    return {
      template: TEMPLATES.orderDetailPart,
      language: LANG,
      bodyParams: partParams,
      preview: `Pedido #${code} (parte ${partParams[1]}): ${text}`,
    };
  });
  return { body, continuation };
}

/** Todos los mensajes que componen un envío, en el orden en que salen. */
export function messageParts(message: OutgoingMessage): TemplateMessage[] {
  const { continuation = [], ...main } = message;
  return [main, ...continuation];
}

/** Si un mensaje de pedido necesitaría más continuaciones de las admitidas. */
export function exceedsMaxParts(message: OutgoingMessage) {
  return (message.continuation?.length ?? 0) > MAX_CONTINUATION_PARTS;
}

/** Quita teléfonos, correos y enlaces que el cliente pueda escribir en las indicaciones. */
export function sanitizeStoreNotes(notes: string | null | undefined) {
  if (!notes) return null;
  const cleaned = notes
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[dato oculto]")
    .replace(/(?:https?:\/\/|www\.)\S+/gi, "[dato oculto]")
    .replace(/\+?\d[\d\s().-]{6,}\d/g, "[dato oculto]")
    .trim();
  return cleaned || null;
}

function itemLines(items: LineView[]) {
  return items.map((i) => `${i.quantity} x ${i.name}${i.options ? ` (${i.options})` : ""}`);
}

const PAYMENT_LABEL = { CASH: "Efectivo", TRANSFER: "Transferencia" } as const;

export function adminNewOrderMessage(o: AdminOrderView): OutgoingMessage {
  const { body: params, continuation } = fitOrderBody(
    [
      o.publicCode,
      o.storeName,
      "",
      o.totalLabel,
      PAYMENT_LABEL[o.paymentMethod],
      o.customerName,
      o.customerPhone,
      o.deliveryAddress,
      o.storeNotes ?? "Sin indicaciones",
    ],
    2,
    itemLines(o.items),
    [
      { index: 8, label: "Indicaciones" },
      { index: 7, label: "Dirección" },
    ],
  );
  return {
    template: TEMPLATES.adminNewOrder,
    language: LANG,
    bodyParams: params,
    preview: `Nuevo pedido #${params[0]} para ${params[1]}: ${params[2]}. Total ${params[3]} (${params[4]}). Cliente: ${params[5]}, ${params[6]}. Dirección: ${params[7]}. Indicaciones: ${params[8]}.`,
    ...(continuation.length > 0 ? { continuation } : {}),
  };
}

export function storeRequestMessage(
  o: StoreOrderView,
  payloads: { accept: string; reject: string },
): OutgoingMessage {
  // Los botones van en el primer mensaje: el comercio puede responder aunque falle una continuación.
  const { body: params, continuation } = fitOrderBody(
    [o.publicCode, "", o.storeNotes ?? "Sin indicaciones"],
    1,
    itemLines(o.items),
    [{ index: 2, label: "Indicaciones" }],
  );
  return {
    template: TEMPLATES.storeRequest,
    language: LANG,
    bodyParams: params,
    quickReplies: [payloads.accept, payloads.reject],
    preview: `Pedido #${params[0]} de Dfly: ${params[1]}. Indicaciones: ${params[2]}. [Aceptar] [Rechazar]`,
    ...(continuation.length > 0 ? { continuation } : {}),
  };
}

export function adminResultMessage(publicCode: string, storeName: string, accepted: boolean): OutgoingMessage {
  const params = [publicCode, storeName, accepted ? "ACEPTADO" : "RECHAZADO"].map(toParam);
  return {
    template: TEMPLATES.adminResult,
    language: LANG,
    bodyParams: params,
    preview: `Pedido #${params[0]}: ${params[1]} lo ${accepted ? "aceptó" : "rechazó"}.`,
  };
}

export function customerResultMessage(
  publicCode: string,
  customerFirstName: string,
  storeName: string,
  accepted: boolean,
): OutgoingMessage {
  const params = [customerFirstName, publicCode, storeName].map(toParam);
  return {
    template: accepted ? TEMPLATES.customerAccepted : TEMPLATES.customerRejected,
    language: LANG,
    bodyParams: params,
    preview: accepted
      ? `Hola ${params[0]}, tu pedido #${params[1]} en ${params[2]} fue confirmado. ¡Ya lo están preparando!`
      : `Hola ${params[0]}, ${params[2]} no pudo tomar tu pedido #${params[1]}. No se te cobrará nada.`,
  };
}

export function adminExpiredMessage(publicCode: string, storeName: string, minutes: number): OutgoingMessage {
  const params = [publicCode, storeName, String(minutes)].map(toParam);
  return {
    template: TEMPLATES.adminExpired,
    language: LANG,
    bodyParams: params,
    preview: `Pedido #${params[0]}: ${params[1]} no respondió en ${params[2]} min. Llama al comercio.`,
  };
}

export function customerCancelledMessage(publicCode: string, customerFirstName: string, storeName: string): OutgoingMessage {
  const params = [customerFirstName, publicCode, storeName].map(toParam);
  return {
    template: TEMPLATES.customerCancelled,
    language: LANG,
    bodyParams: params,
    preview: `Hola ${params[0]}, tu pedido #${params[1]} en ${params[2]} fue cancelado. No se te cobrará nada.`,
  };
}

/** Aviso al comercio: solo código y nombre del comercio, nunca datos del cliente. */
export function storeCancelledMessage(o: Pick<StoreOrderView, "publicCode" | "storeName">): OutgoingMessage {
  const params = [o.publicCode, o.storeName].map(toParam);
  return {
    template: TEMPLATES.storeCancelled,
    language: LANG,
    bodyParams: params,
    preview: `Pedido #${params[0]} de Dfly para ${params[1]} fue CANCELADO. No lo prepares.`,
  };
}

type LateState = "EXPIRED" | "CANCELLED";

/**
 * Al comercio cuando el pedido deja de estar vigente (vence o se cancela tras su respuesta tardía):
 * solo código, su nombre y el estado. Nunca datos del cliente. Sirve antes y después de que pulse.
 */
export function storeLateResponseMessage(
  o: Pick<StoreOrderView, "publicCode" | "storeName">,
  state: LateState,
): OutgoingMessage {
  const params = [o.publicCode, o.storeName, state === "EXPIRED" ? "VENCIDO" : "CANCELADO"].map(toParam);
  return {
    template: TEMPLATES.storeLate,
    language: LANG,
    bodyParams: params,
    preview: `Pedido #${params[0]} de Dfly para ${params[1]} ya está ${params[2]}: NO lo prepares. Si pulsas Aceptar o Rechazar, no se registrará. Dfly te contactará si hace falta.`,
  };
}

/** Al dueño: el cliente canceló antes de que el comercio aceptara. */
export function adminCustomerCancelledMessage(publicCode: string, storeName: string): OutgoingMessage {
  const params = [publicCode, storeName].map(toParam);
  return {
    template: TEMPLATES.adminCustomerCancelled,
    language: LANG,
    bodyParams: params,
    preview: `Pedido #${params[0]} (${params[1]}): el cliente lo canceló antes de que el comercio lo aceptara.`,
  };
}

/** Al dueño: el cliente pide cancelar un pedido ya aceptado; se resuelve en el panel. */
export function adminCancelRequestMessage(
  publicCode: string,
  storeName: string,
  customerName: string,
  reason: string,
): OutgoingMessage {
  // Sin punto final: la plantilla ya sigue con ". Revísalo en el panel".
  const params = [publicCode, storeName, customerName, reason.trim().replace(/[.\s]+$/, "")].map(toParam);
  return {
    template: TEMPLATES.adminCancelRequest,
    language: LANG,
    bodyParams: params,
    preview: `Pedido #${params[0]} (${params[1]}): ${params[2]} pide cancelarlo. Motivo: ${params[3]}. Revísalo en el panel.`,
  };
}

/** Al cliente: Dfly no aprobó cancelar su pedido ya aceptado. */
export function customerCancelRejectedMessage(publicCode: string, customerFirstName: string, storeName: string): OutgoingMessage {
  const params = [customerFirstName, publicCode, storeName].map(toParam);
  return {
    template: TEMPLATES.customerCancelRejected,
    language: LANG,
    bodyParams: params,
    preview: `Hola ${params[0]}, no pudimos cancelar tu pedido #${params[1]} en ${params[2]}: el comercio ya lo está preparando. Escríbenos si tienes dudas.`,
  };
}

/** Al dueño: el comercio pulsó un botón con el pedido ya vencido o cancelado. */
export function adminLateResponseMessage(
  publicCode: string,
  storeName: string,
  accepted: boolean,
  state: LateState,
): OutgoingMessage {
  const params = [publicCode, storeName, accepted ? "ACEPTAR" : "RECHAZAR", state === "EXPIRED" ? "vencido" : "cancelado"].map(
    toParam,
  );
  return {
    template: TEMPLATES.adminLate,
    language: LANG,
    bodyParams: params,
    preview: `Pedido #${params[0]}: ${params[1]} pulsó ${params[2]} con el pedido ya ${params[3]}.`,
  };
}

/** Código de verificación del celular (plantilla de autenticación de Meta). */
export function authCodeMessage(code: string): OutgoingMessage {
  return {
    template: TEMPLATES.authCode,
    language: LANG,
    bodyParams: [code],
    otpCode: code,
    preview: `${code} es tu código de verificación de Dfly.`,
  };
}
