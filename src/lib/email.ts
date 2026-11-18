import "server-only";

export type OutgoingEmail = { to: string; subject: string; text: string; html: string };

/**
 * Envía un email con la API de Resend (sin SDK). Sin `RESEND_API_KEY`, solo en desarrollo,
 * lo registra en la consola del servidor como `[email:dev]`.
 */
export async function sendEmail(email: OutgoingEmail): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    if (process.env.NODE_ENV === "production") throw new Error("Faltan RESEND_API_KEY / EMAIL_FROM en producción");
    console.info(`[email:dev] → ${email.to}: ${email.subject}\n  ${email.text.replace(/\n/g, "\n  ")}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      // Resend rechaza (403) las peticiones sin User-Agent.
      "User-Agent": "dfly-app/1.0",
    },
    body: JSON.stringify({ from, to: [email.to], subject: email.subject, text: email.text, html: email.html }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(`Resend ${res.status}: ${data?.message ?? "respuesta inesperada"}`);
  }
}
