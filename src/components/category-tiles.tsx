import Image from "next/image";
import Link from "next/link";
import { StoreGlyph } from "@/components/store-glyph";
import { CATEGORIES } from "@/modules/catalog/categories";

/**
 * Selector de categoría con foto para `/comercios`: "Todos" (ícono de tienda) y una
 * tarjeta por categoría con su foto de `public/categorias/`. La elegida queda marcada.
 * En móvil van en 3 columnas; desde `sm`, las 6 en una fila.
 */
export function CategoryTiles({ active }: { active: string }) {
  const items = [{ slug: "", label: "Todos", image: null }, ...CATEGORIES];

  return (
    <nav aria-label="Categorías">
      <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
        {items.map(({ slug, label, image }) => {
          const isActive = active === slug;
          return (
            <li key={slug || "todos"}>
              <Link
                href={slug ? `/comercios?categoria=${slug}` : "/comercios"}
                aria-current={isActive ? "page" : undefined}
                className={`flex h-full flex-col items-center gap-1.5 rounded-surface p-1.5 pb-2 text-ink sm:p-2 sm:pb-2.5 no-underline transition-[box-shadow,background-color] duration-150 hover:shadow-lift ${
                  isActive ? "bg-route/15 ring-2 ring-route" : "bg-surface ring-1 ring-line"
                }`}
              >
                <span className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl bg-surface">
                  {image ? (
                    <Image
                      src={image}
                      alt=""
                      width={140}
                      height={140}
                      sizes="(min-width: 640px) 140px, 30vw"
                      className="size-full object-contain"
                    />
                  ) : (
                    <StoreGlyph className="size-1/2 text-store" />
                  )}
                </span>
                <span className="max-w-full text-center text-[12px] leading-tight font-semibold sm:text-[13px]">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
