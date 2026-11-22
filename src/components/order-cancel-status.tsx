import Link from "next/link";
import type { CancellationRequestStatus, OrderStatus } from "@/generated/prisma/enums";
import { customerCanCancelNow, customerCanRequestCancel } from "@/modules/ordering/domain";
import { CancelMyOrder, RequestCancelForm } from "./order-cancel";

type Props = {
  code: string;
  status: OrderStatus;
  request: { status: CancellationRequestStatus } | null;
  /** En Ayuda se muestra el formulario; en la página del pedido, un enlace a Ayuda. */
  place: "order" | "help";
};

/** Qué puede hacer el cliente para cancelar, según el estado del pedido. Server Component. */
export function OrderCancelOptions({ code, status, request, place }: Props) {
  if (customerCanCancelNow(status)) return <CancelMyOrder code={code} />;

  if (request?.status === "PENDING") {
    return (
      <p className="text-[15px] leading-snug">
        <span className="font-semibold">Solicitaste cancelar este pedido.</span> Lo estamos revisando y te avisamos por
        WhatsApp.
      </p>
    );
  }
  if (request?.status === "REJECTED") {
    return (
      <p className="text-[15px] leading-snug">
        <span className="font-semibold">Tu solicitud de cancelación no fue aprobada:</span> el comercio ya lo estaba
        preparando. Si tienes dudas, escríbenos por WhatsApp.
      </p>
    );
  }

  if (customerCanRequestCancel(status)) {
    if (place === "help") return <RequestCancelForm code={code} />;
    return (
      <p className="text-[15px] leading-snug">
        El comercio ya lo aceptó, así que no se puede cancelar al instante.{" "}
        <Link href={`/ayuda/pedido/${code}`} className="font-semibold text-brand underline underline-offset-2 hover:text-brand-deep">
          Solicitar la cancelación en Ayuda
        </Link>
      </p>
    );
  }

  return place === "help" ? (
    <p className="text-[15px] text-ink-soft">Este pedido ya terminó, así que no se puede cancelar.</p>
  ) : null;
}
