import { isAuthorizedCron } from "@/lib/cron-auth";
import { dispatchOrderMessages } from "@/modules/ordering/dispatch";

/** Reintenta los mensajes de WhatsApp pendientes. Programar cada minuto. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  return Response.json(await dispatchOrderMessages({ limit: 50 }));
}
