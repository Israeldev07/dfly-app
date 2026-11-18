import { createHmac, timingSafeEqual } from "node:crypto";

/** Verifica la cabecera X-Hub-Signature-256 ("sha256=<hex>") sobre el cuerpo crudo. */
export function isValidSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex"));
  const received = Buffer.from(header.slice("sha256=".length));
  return expected.length === received.length && timingSafeEqual(expected, received);
}

export type ButtonTap = { messageId: string; from: string; payload: string };

type WebhookBody = {
  entry?: {
    changes?: {
      value?: {
        metadata?: { phone_number_id?: string };
        messages?: {
          id?: string;
          from?: string;
          type?: string;
          button?: { payload?: string };
          text?: { body?: string };
          interactive?: { button_reply?: { id?: string } };
        }[];
      };
    }[];
  }[];
};

type InboundMessage = NonNullable<NonNullable<NonNullable<NonNullable<WebhookBody["entry"]>[number]["changes"]>[number]["value"]>["messages"]>[number];

/** Mensajes entrantes dirigidos a nuestro número. */
function* inboundMessages(body: unknown, phoneNumberId: string | undefined): Generator<InboundMessage> {
  for (const entry of (body as WebhookBody)?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value;
      if (phoneNumberId && value?.metadata?.phone_number_id !== phoneNumberId) continue;
      yield* value?.messages ?? [];
    }
  }
}

/** Extrae las pulsaciones de botones (plantilla quick reply o botón interactivo) dirigidas a nuestro número. */
export function extractButtonTaps(body: unknown, phoneNumberId: string | undefined): ButtonTap[] {
  const taps: ButtonTap[] = [];
  for (const msg of inboundMessages(body, phoneNumberId)) {
    const payload =
      msg.type === "button" ? msg.button?.payload : msg.type === "interactive" ? msg.interactive?.button_reply?.id : undefined;
    if (msg.id && msg.from && payload) taps.push({ messageId: msg.id, from: msg.from, payload });
  }
  return taps;
}

export type TextMessage = { messageId: string; from: string; text: string };

/** Mensajes de texto entrantes (p. ej. el código con el que un cliente verifica su celular). */
export function extractTextMessages(body: unknown, phoneNumberId: string | undefined): TextMessage[] {
  const texts: TextMessage[] = [];
  for (const msg of inboundMessages(body, phoneNumberId)) {
    const text = msg.type === "text" ? msg.text?.body : undefined;
    if (msg.id && msg.from && text) texts.push({ messageId: msg.id, from: msg.from, text: text.slice(0, 500) });
  }
  return texts;
}
