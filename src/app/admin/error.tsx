"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Error inesperado en el panel: una consulta que falló o una acción rechazada porque la sesión caducó
 * (`assertAdmin`). En producción el mensaje real no llega al navegador; queda en los logs con su `digest`.
 */
export default function AdminError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main role="alert" className="flex flex-col gap-4 rounded-surface bg-surface p-6 ring-1 ring-line sm:p-8">
      <h1 className="font-display text-[26px] leading-tight tracking-[-0.02em]">Algo salió mal en el panel</h1>
      <p className="max-w-prose text-[15px] text-ink-soft">
        No se pudo completar lo que pediste. Vuelve a intentarlo; si tu sesión caducó, inicia sesión de nuevo.
        {error.digest ? <span className="tabular block pt-1 text-[13px]">Referencia: {error.digest}</span> : null}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => retry()}
          className="press inline-flex h-11 items-center rounded-control bg-brand-deep px-4 text-[15px] font-bold text-white hover:bg-brand-deep/90"
        >
          Volver a intentar
        </button>
        <Link
          href="/login?callbackUrl=/admin"
          className="inline-flex h-11 items-center rounded-control px-4 text-[15px] font-semibold text-ink no-underline ring-1 ring-ink/20 hover:bg-ink/[0.05]"
        >
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
