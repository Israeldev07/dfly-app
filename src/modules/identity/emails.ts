/**
 * Correos de la cuenta (código de verificación y recuperación de contraseña).
 * Puros para poder testearlos; los envía `lib/email.ts`.
 */
import type { OutgoingEmail } from "@/lib/email";
import { CODE_TTL_MIN, RESET_TOKEN_TTL_MIN } from "./verification-code";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function greeting(name: string | null) {
  const first = name?.trim().split(/\s+/)[0];
  return first ? `Hola ${first},` : "Hola,";
}

const WRAP = 'style="font-family:Arial,Helvetica,sans-serif;color:#262626;font-size:16px;line-height:1.5"';
const SMALL = 'style="color:#5c5c5c;font-size:14px"';

export function emailCodeMessage(to: string, name: string | null, code: string): OutgoingEmail {
  const hello = greeting(name);
  const note = `Vence en ${CODE_TTL_MIN.EMAIL} minutos. Si no creaste una cuenta en Dfly, ignora este mensaje.`;
  return {
    to,
    subject: `Tu código de Dfly: ${code}`,
    text: [hello, "", `Tu código para verificar tu correo en Dfly es: ${code}`, "", note].join("\n"),
    html: `<div ${WRAP}>
<p>${escapeHtml(hello)}</p>
<p>Tu código para verificar tu correo en Dfly es:</p>
<p style="font-size:32px;font-weight:700;letter-spacing:6px;margin:16px 0">${code}</p>
<p ${SMALL}>${note}</p>
</div>`,
  };
}

export function passwordResetMessage(to: string, name: string | null, link: string): OutgoingEmail {
  const hello = greeting(name);
  const note = `El enlace vence en ${RESET_TOKEN_TTL_MIN} minutos y sirve una sola vez. Si no lo pediste, ignora este mensaje: tu contraseña no cambia.`;
  return {
    to,
    subject: "Restablece tu contraseña de Dfly",
    text: [hello, "", "Para elegir una contraseña nueva, abre este enlace:", link, "", note].join("\n"),
    html: `<div ${WRAP}>
<p>${escapeHtml(hello)}</p>
<p>Para elegir una contraseña nueva, pulsa el botón:</p>
<p style="margin:20px 0"><a href="${escapeHtml(link)}" style="background:#262626;color:#ffffff;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Restablecer contraseña</a></p>
<p ${SMALL}>Si el botón no funciona, copia este enlace: ${escapeHtml(link)}</p>
<p ${SMALL}>${note}</p>
</div>`,
  };
}
