import { isAuthorizedCron } from "@/lib/cron-auth";
import { pruneRateLimits } from "@/lib/rate-limit";
import { purgeExpiredCodes } from "@/modules/identity/verification-store";
import { dispatchOrderMessages } from "@/modules/ordering/dispatch";
import { expireStaleOrders } from "@/modules/ordering/store-response";

/**
 * Marca como vencidos los pedidos sin respuesta del comercio y avisa al dueño. Programar cada minuto.
 * De paso borra las ventanas de rate limiting y los códigos de verificación vencidos.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) return new Response("Unauthorized", { status: 401 });
  const result = await expireStaleOrders();
  if (result.expired > 0) await dispatchOrderMessages({ limit: 50 });
  const prunedRateLimits = await pruneRateLimits();
  const prunedCodes = await purgeExpiredCodes();
  return Response.json({ ...result, prunedRateLimits, prunedCodes });
}
