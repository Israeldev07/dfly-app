import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

export type OutgoingEmail = { to: string; subject: string; text: string; html: string };

let transporter: Transporter | null = null;

function smtp(): Transporter | null {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  // Uno solo por proceso: cada transporter abre conexiones y se autentica.
  transporter ??= nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || 587),
    // 465 = TLS directo; 587 = STARTTLS (nodemailer lo negocia y lo exige con `requireTLS`).
    secure: process.env.SMTP_SECURE === "true" || process.env.SMTP_PORT === "465",
    requireTLS: process.env.SMTP_SECURE !== "true" && process.env.SMTP_PORT !== "465",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    connectionTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transporter;
}

/**
 * Envía un correo por SMTP (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`).
 * Sin `SMTP_HOST`, solo en desarrollo, lo registra en la consola del servidor como `[email:dev]`.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const from = process.env.EMAIL_FROM;
  const transport = smtp();
  if (!transport || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Faltan SMTP_HOST / EMAIL_FROM en producción");
    console.info(`[email:dev] → ${email.to}: ${email.subject}\n  ${email.text.replace(/\n/g, "\n  ")}`);
    return;
  }
  await transport.sendMail({ from, to: email.to, subject: email.subject, text: email.text, html: email.html });
}

/**
 * URL pública de la app para los enlaces de los correos. Nunca se toma del `Host` de la petición:
 * quien lo falsificara recibiría el enlace de recuperación de otra persona en su dominio.
 */
export function appUrl(): string {
  const url = process.env.APP_URL;
  if (url) return url.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") throw new Error("Falta APP_URL en producción");
  return "http://localhost:3000";
}
