import Link from "next/link";
import { StoreAvatar } from "@/components/store-avatar";
import { categoryLabel } from "@/modules/catalog/categories";
import type { PublicStore } from "@/modules/catalog/queries";

/** Tarjeta de comercio para la fila horizontal de la portada: foto arriba y datos debajo. */
export function StoreCard({ store }: { store: PublicStore }) {
  return (
    <Link
      href={`/comercios/${store.slug}`}
      className="press group flex h-full flex-col gap-4 rounded-surface bg-surface p-4 text-ink no-underline shadow-lift ring-1 ring-line"
    >
      <StoreAvatar
        imageUrl={store.imageUrl}
        px={320}
        className="aspect-[4/3] h-auto w-full"
        glyphClassName="size-14"
      />
      <div className="flex min-w-0 flex-col gap-1.5 px-1 pb-1">
        <h3 className="truncate font-display text-[20px] leading-tight tracking-[-0.02em]">{store.name}</h3>
        <p className="text-[13.5px] leading-snug text-ink/70">
          {categoryLabel(store.category)} · {store.sector}
        </p>
        <p className="text-[13.5px] font-semibold text-store">Entrega en {store.etaMinutes} min</p>
      </div>
    </Link>
  );
}
