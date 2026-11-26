import type { ReactNode } from "react";

/** Datos del responsable que muestran la política de privacidad, los términos y el pie de página. */
export const LEGAL = {
  owner: "Dilan Anderson Vega Perugachi",
  brand: "Dfly",
  address: "Calle Bolívar entre Quiroga, Otavalo, Imbabura, Ecuador",
  email: "deliverydfly@gmail.com",
  whatsappLabel: "096 878 8068",
  whatsappUrl: "https://wa.me/593968788068",
  site: "https://dflyec.com",
  updatedAt: "2026-11-26",
  updatedAtLabel: "26 de noviembre de 2026",
} as const;

export type LegalSection = { id: string; title: string; body: ReactNode };

/** Página de texto legal: título, fecha, índice y secciones numeradas con ancla. */
export function LegalPage({ title, intro, sections }: { title: string; intro: ReactNode; sections: LegalSection[] }) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 pt-8 pb-24 sm:px-8 sm:pt-12">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-[32px] leading-none tracking-[-0.03em] text-balance sm:text-[40px]">{title}</h1>
        <p className="text-[14px] text-ink-soft">
          Última actualización: <time dateTime={LEGAL.updatedAt}>{LEGAL.updatedAtLabel}</time>
        </p>
        <div className="legal-prose max-w-[68ch] text-[15.5px] leading-[1.65]">{intro}</div>
      </header>

      <nav aria-label="Contenido" className="rounded-surface bg-surface px-5 py-4 ring-1 ring-line">
        <p className="mb-2 text-[13px] font-bold tracking-[0.08em] text-ink-soft">CONTENIDO</p>
        <ol className="grid gap-x-6 gap-y-1.5 text-[14.5px] sm:grid-cols-2">
          {sections.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-store no-underline hover:underline">
                <span className="tabular text-ink-soft">{i + 1}.</span> {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="flex flex-col gap-9">
        {sections.map((s, i) => (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-t`} className="scroll-mt-24">
            <h2 id={`${s.id}-t`} className="mb-3 text-[20px] font-bold tracking-[-0.01em]">
              <span className="tabular text-ink-soft">{i + 1}.</span> {s.title}
            </h2>
            <div className="legal-prose max-w-[68ch] text-[15.5px] leading-[1.65]">{s.body}</div>
          </section>
        ))}
      </div>
    </main>
  );
}

/** Bloque con los datos de contacto para ejercer derechos o resolver dudas. */
export function LegalContact() {
  return (
    <ul>
      <li>
        Correo:{" "}
        <a href={`mailto:${LEGAL.email}`} className="font-semibold">
          {LEGAL.email}
        </a>
      </li>
      <li>
        WhatsApp:{" "}
        <a href={LEGAL.whatsappUrl} target="_blank" rel="noopener noreferrer" className="font-semibold">
          {LEGAL.whatsappLabel}
        </a>
      </li>
      <li>Dirección: {LEGAL.address}</li>
    </ul>
  );
}
