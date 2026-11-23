import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CategoryChips } from "@/components/category-chips";
import { HeroVideo } from "@/components/hero-video";
import { StoreCard } from "@/components/store-card";
import { listStores } from "@/modules/catalog/queries";

/** Posición en la entrada escalonada del hero (ver `.hero-in` en globals.css). */
const step = (i: number) => ({ "--i": i }) as CSSProperties;

export default async function HomePage() {
  const stores = await listStores().catch(() => []);

  return (
    <main className="flex flex-1 flex-col">
      {/* Móvil y tablet: video arriba y texto debajo sobre azul oscuro. Escritorio: video de fondo
          contenido a la derecha; su fondo no es plano, así que el borde izquierdo se desvanece hacia
          el azul medio del MP4 (`--color-hero`) y un velo a la izquierda deja leer el texto. */}
      <section className="relative isolate overflow-hidden bg-hero-deep lg:bg-hero">
        <div className="relative lg:absolute lg:inset-0 lg:-z-10">
          <HeroVideo className="block aspect-[4/3] w-full bg-hero object-cover object-[85%_50%] sm:aspect-video lg:ml-auto lg:h-full lg:w-auto lg:max-w-none lg:[mask-image:linear-gradient(to_right,transparent,black_30%)]" />
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-b from-transparent from-75% to-hero-deep lg:bg-linear-to-r lg:from-hero-deep/80 lg:from-0% lg:via-hero-deep/40 lg:via-35% lg:to-transparent lg:to-55%"
          />
        </div>
        <div className="mx-auto flex w-full max-w-7xl flex-col justify-center gap-7 px-4 pt-6 pb-14 sm:gap-8 sm:px-8 sm:pb-[72px] lg:min-h-[600px] lg:pt-[72px]">
          <h1
            style={step(0)}
            className="hero-in max-w-[11ch] font-display text-[44px] leading-[0.96] tracking-[-0.035em] text-balance text-paper sm:text-[60px]"
          >
            Todo lo que necesitas, en una sola <span className="text-route">ruta</span>.
          </h1>
          <p style={step(1)} className="hero-in max-w-[44ch] text-[16px] leading-[1.55] font-medium text-paper">
            Restaurantes, market, farmacia, bebidas y mascotas de Otavalo en un solo lugar. Elige qué
            necesitas y te lo llevamos.
          </p>
          <div style={step(2)} className="hero-in">
            <Link
              href="/comercios"
              className="press inline-flex h-14 items-center gap-2.5 rounded-control bg-route px-7 text-[15px] font-bold text-ink no-underline hover:bg-route-deep"
            >
              Ver comercios
              <ArrowRight aria-hidden className="size-[18px]" strokeWidth={2.25} />
            </Link>
          </div>
          <div style={step(3)} className="hero-in">
            <CategoryChips tone="dark" />
          </div>
        </div>
      </section>

      {/* Comercios en una fila horizontal: en móvil se desliza con el dedo (con imán por tarjeta);
          en pantallas anchas caben varios a la vez y el resto se alcanza con scroll lateral. */}
      <section aria-labelledby="comercios" className="mx-auto flex w-full max-w-7xl flex-col gap-7 pt-16 pb-20 sm:pt-[72px] sm:pb-[84px]">
        <div className="flex items-end justify-between gap-4 px-4 sm:px-8">
          <h2 id="comercios" className="font-display text-[26px] leading-none tracking-[-0.025em] sm:text-[32px]">
            Comercios en Otavalo
          </h2>
          {stores.length > 0 ? (
            <Link
              href="/comercios"
              className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-store no-underline hover:underline"
            >
              Ver todos
              <ArrowRight aria-hidden className="size-4" strokeWidth={2} />
            </Link>
          ) : null}
        </div>
        {stores.length > 0 ? (
          <ul className="flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pt-1 pb-4 sm:scroll-px-8 sm:gap-5 sm:px-8">
            {stores.map((s) => (
              <li key={s.id} className="w-[72%] flex-none snap-start sm:w-[280px]">
                <StoreCard store={s} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="max-w-[40ch] px-4 text-[15px] text-ink-soft sm:px-8">
            Estamos sumando comercios de Otavalo. Vuelve pronto.
          </p>
        )}
      </section>

      {/* Trayectoria de la empresa, en el azul del hero. */}
      <section aria-labelledby="trayectoria" className="bg-hero-deep text-paper">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 pt-14 pb-16 sm:px-8 sm:pt-[72px] sm:pb-[80px] lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="flex flex-col gap-4">
            <p className="text-[12.5px] font-bold tracking-[0.14em] text-route">DELIVERY FLYMOTO.EC</p>
            <h2
              id="trayectoria"
              className="max-w-[18ch] font-display text-[30px] leading-[1.05] tracking-[-0.025em] text-balance sm:text-[38px]"
            >
              Conectamos lo que necesitas con el lugar donde lo necesitas.
            </h2>
          </div>
          <div className="flex flex-col gap-5 text-[15.5px] leading-[1.6] text-paper/85">
            <p>
              Desde Otavalo, construimos una nueva forma de entender el servicio de delivery: más ágil, más
              cercana y pensada para las necesidades reales de nuestros clientes y aliados comerciales.
            </p>
            <p>
              Realizamos entregas de comida rápida, supermercados, paquetería, medicamentos y diferentes tipos
              de pedidos, brindando una alternativa práctica para quienes necesitan enviar o recibir productos
              de manera eficiente.
            </p>
            <p className="border-l-2 border-route pl-4 text-paper">
              Desde el{" "}
              <time dateTime="2023-11-19" className="font-bold text-route">
                19 de noviembre de 2023
              </time>
              , hemos trabajado para convertir cada entrega en una experiencia basada en confianza,
              responsabilidad y eficiencia.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
