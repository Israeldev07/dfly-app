import "server-only";
import { authCodeMessage } from "./messages";
import { getTransport } from "./transport";

/**
 * Envía el código de verificación del celular al momento, sin pasar por el outbox: no depende de ningún
 * cambio de estado, el usuario lo está esperando en pantalla y, si falla, debe enterarse para pedir otro
 * (un reintento minutos después ya no le sirve). Es la única excepción a "todo mensaje se encola".
 */
export async function sendAuthCode(to: string, code: string): Promise<void> {
  await getTransport().send(to, authCodeMessage(code));
}
