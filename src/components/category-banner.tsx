import Image from "next/image";

type Props = {
  label: string;
  image: string;
  count: number;
};

/**
 * Portada de una categoría: título a la izquierda y la foto completa a la derecha.
 * Las fotos (`public/categorias/<slug>.jpg`) son cuadradas, de producto sobre fondo
 * blanco, así que van sin recortar sobre la superficie blanca.
 */
export function CategoryBanner({ label, image, count }: Props) {
  return (
    <section
      aria-label={label}
      className="flex items-center justify-between gap-4 overflow-hidden rounded-surface bg-surface py-3 pr-3 pl-5 ring-1 ring-line sm:gap-8 sm:py-4 sm:pr-6 sm:pl-8"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="font-display text-[30px] leading-none tracking-[-0.03em] sm:text-[44px]">{label}</h2>
        <p className="text-[15px] text-ink-soft">
          En Otavalo · <span className="tabular">{count}</span> {count === 1 ? "disponible" : "disponibles"}
        </p>
      </div>
      <Image
        src={image}
        alt=""
        width={208}
        height={208}
        sizes="(min-width: 640px) 208px, 128px"
        priority
        className="size-32 flex-none object-contain sm:size-52"
      />
    </section>
  );
}
