import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { OrderCancelOptions } from "@/components/order-cancel-status";
import { formatUsd } from "@/lib/money";
import { requireUser } from "@/modules/identity/session";
import { getCustomerOrder } from "@/modules/ordering/queries";
import { STATUS_COPY } from "@/modules/ordering/status-copy";

export async function generateMetadata({ params }: PageProps<"/ayuda/pedido/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Ayuda con el pedido #${code}` };
}

export default async function HelpOrderPage({ params }: PageProps<"/ayuda/pedido/[code]">) {
  const { code } = await params;
  const user = await requireUser(`/ayuda/pedido/${code}`);
  const order = await getCustomerOrder(code.toUpperCase(), user.id);
  if (!order) notFound();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pt-8 pb-20 sm:px-8 sm:pt-12">
      <Link
        href="/ayuda"
        className="inline-flex w-fit items-center gap-2 text-[14px] font-medium text-ink/70 no-underline hover:text-ink"
      >
        <ArrowLeft aria-hidden className="size-4" strokeWidth={2} />
        Centro de ayuda
      </Link>

      <div className="flex flex-col gap-2">
        <p className="text-[14px] font-medium text-ink-soft">Problemas con un pedido</p>
        <h1 className="font-display text-[32px] leading-none tracking-[-0.03em] sm:text-[40px]">
          Pedido <span className="tabular">#{order.publicCode}</span>
        </h1>
        <p className="text-[15px] text-ink-soft">
          {order.store.name} · {STATUS_COPY[order.status].label} ·{" "}
          <span className="tabular">{formatUsd(order.totalCents)}</span>
        </p>
      </div>

      <section aria-labelledby="cancelar" className="flex flex-col gap-4 rounded-surface bg-surface p-5 ring-1 ring-line sm:p-7">
        <h2 id="cancelar" className="text-[18px] font-bold">
          Cancelar
        </h2>
        <OrderCancelOptions code={order.publicCode} status={order.status} request={order.cancellationRequest} place="help" />
      </section>

      <Link
        href={`/pedidos/${order.publicCode}`}
        className="w-fit font-semibold text-brand underline underline-offset-2 hover:text-brand-deep"
      >
        Ver el estado del pedido
      </Link>
    </main>
  );
}
