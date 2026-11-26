import Link from "next/link";
import { LEGAL } from "@/components/legal-page";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 text-[14px] text-ink-soft sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-1">
          <span className="font-display text-[18px] tracking-[-0.03em] text-brand">{LEGAL.brand}</span>
          <span>Delivery en Otavalo, Ecuador</span>
        </div>
        <nav aria-label="Legal y contacto">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href="/terminos" className="text-ink no-underline hover:underline">
                Términos y condiciones
              </Link>
            </li>
            <li>
              <Link href="/privacidad" className="text-ink no-underline hover:underline">
                Política de privacidad
              </Link>
            </li>
            <li>
              <a href={LEGAL.whatsappUrl} target="_blank" rel="noopener noreferrer" className="text-ink no-underline hover:underline">
                WhatsApp {LEGAL.whatsappLabel}
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}
