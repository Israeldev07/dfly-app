"use client";

import type { ReactNode } from "react";

/** Campo para el código de 6 dígitos. `one-time-code` deja que el celular lo proponga desde el SMS o WhatsApp. */
export function CodeField({ id, error, hint }: { id: string; error?: string; hint: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[14px] font-semibold">
        Código de 6 dígitos
      </label>
      <input
        id={id}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9 ]*"
        maxLength={7}
        placeholder="123456"
        required
        aria-describedby={`${id}-hint`}
        aria-invalid={error ? true : undefined}
        className="tabular h-12 w-full max-w-56 rounded-control bg-surface px-4 text-[20px] font-bold tracking-[0.3em] text-ink ring-1 ring-ink/20 transition-shadow duration-150 outline-none placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-ink-soft hover:ring-ink/35 focus-visible:ring-2 focus-visible:ring-route-deep aria-invalid:ring-2 aria-invalid:ring-brand"
      />
      <p id={`${id}-hint`} className="text-[13px] text-ink-soft">
        {hint}
      </p>
    </div>
  );
}

export function LinkButton({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="min-h-11 text-[14px] font-semibold text-brand underline underline-offset-2 hover:text-brand-deep disabled:opacity-60"
    >
      {children}
    </button>
  );
}
