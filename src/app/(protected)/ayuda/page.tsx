import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, PackageX } from "lucide-react";
import { formatUsd } from "@/lib/money";
import { requireUser } from "@/modules/identity/session";
import { listHelpOrders } from "@/modules/ordering/queries";
import { STATUS_COPY } from "@/modules/ordering/status-copy";

export const metadata: Metadata = { title: "Centro de ayuda" };

const shortDate = new Intl.DateTimeFormat("es-EC", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

export default async function HelpPage() {
  const user = await requireUser("/ayuda");
  const orders = await listHelpOrders(user.id);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-4 pt-8 pb-20 sm:px-8 sm:pt-12">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[32px] leading-none tracking-[-0.03em] sm:text-[40px]">Centro de ayuda</h1>
        <p className="text-[15px] text-ink-soft">Cuéntanos qué pasó y lo resolvemos contigo.</p>
      </div>

      <section aria-labelledby="problemas" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 id="problemas" className="flex items-center gap-2 text-[20px] font-bold tracking-[-0.01em]">
            <PackageX aria-hidden className="size-[22px] text-store" strokeWidth={1.75} />
            Problemas con un pedido
          </h2>
          <p className="text-[15px] text-ink-soft">Elige el pedido para cancelarlo o ver qué opciones tienes.</p>
        </div>

        {orders.length === 0 ? (
          <p className="rounded-surface bg-surface px-5 py-4 text-[15px] ring-1 ring-line">
            Todavía no tienes pedidos.{" "}
            <Link href="/comercios" className="font-semibold text-brand underline underline-offset-2 hover:text-brand-deep">
              Ver comercios
            </Link>
          </p>
        ) : (
          <ul className="divide-y divide-line overflow-hidden rounded-surface bg-surface ring-1 ring-line">
            {orders.map((o) => (
              <li key={o.publicCode}>
                <Link
                  href={`/ayuda/pedido/${o.publicCode}`}
                  className="flex min-h-16 items-center gap-4 px-5 py-3.5 text-ink no-underline transition-colors duration-150 hover:bg-ink/[0.03]"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-[15px] font-semibold">
                      <span className="tabular">#{o.publicCode}</span> · {o.store.name}
                    </span>
                    <span className="text-[13.5px] text-ink-soft">
                      {STATUS_COPY[o.status].label}
                      {o.cancellationRequest?.status === "PENDING" ? " · Cancelación solicitada" : ""} ·{" "}
                      <span className="tabular">{shortDate.format(o.createdAt)}</span>
                    </span>
                  </span>
                  <span className="tabular flex-none text-[15px] font-bold">{formatUsd(o.totalCents)}</span>
                  <ArrowRight aria-hidden className="size-[18px] flex-none text-ink/35" strokeWidth={1.75} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
