"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CheckCircle2, LoaderCircle, TriangleAlert } from "lucide-react";
import { FormError, SubmitButton, TextareaField } from "@/components/forms";
import { cancelMyOrderAction, requestCancellationAction, type CancelState } from "@/modules/ordering/cancel-actions";

/** Cancelar al instante (el comercio aún no aceptó), en dos pasos y sin modal. */
export function CancelMyOrder({ code }: { code: string }) {
  const [state, action] = useActionState<CancelState, FormData>(cancelMyOrderAction, {});
  const [confirming, setConfirming] = useState(false);

  if (state.needsRequest) {
    return (
      <div className="flex flex-col gap-2">
        <FormError message={state.error} />
        <Link
          href={`/ayuda/pedido/${code}`}
          className="w-fit font-semibold text-brand underline underline-offset-2 hover:text-brand-deep"
        >
          Solicitar la cancelación en Ayuda
        </Link>
      </div>
    );
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <FormError message={state.error} />
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="inline-flex h-12 w-full items-center justify-center rounded-control px-5 text-[15px] font-semibold text-brand-deep ring-1 ring-brand/40 transition-colors duration-150 hover:bg-brand/[0.06] sm:w-fit"
        >
          Cancelar pedido
        </button>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-3 rounded-control bg-brand/[0.06] p-4">
      <input type="hidden" name="code" value={code} />
      <p className="text-[15px] leading-snug">
        <span className="font-bold">¿Cancelar este pedido?</span> El comercio todavía no lo aceptó, así que se cancela al
        instante y no se te cobrará nada. No se puede deshacer.
      </p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <ConfirmCancelButton />
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="inline-flex h-[52px] items-center justify-center rounded-control px-5 text-[15px] font-semibold text-ink hover:bg-ink/[0.06]"
        >
          No, mantener pedido
        </button>
      </div>
    </form>
  );
}

/** Acción irreversible: en rojo de marca, no en el cian de las acciones principales. */
function ConfirmCancelButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending || undefined}
      className="press inline-flex h-[52px] items-center justify-center gap-2 rounded-control bg-brand-deep px-6 text-[15px] font-bold text-white hover:bg-brand-deep/90 disabled:cursor-progress disabled:opacity-70"
    >
      {pending ? <LoaderCircle aria-hidden className="size-[18px] animate-spin motion-reduce:animate-none" /> : null}
      {pending ? "Cancelando…" : "Sí, cancelar pedido"}
    </button>
  );
}

/** Aviso de los Términos y Condiciones para cancelaciones tardías. */
export function LateCancelWarning() {
  return (
    <p className="flex items-start gap-2.5 rounded-control bg-brand/[0.06] px-4 py-3 text-[14px] leading-snug text-ink/85">
      <TriangleAlert aria-hidden className="mt-0.5 size-[18px] flex-none text-brand-deep" strokeWidth={2} />
      <span>
        <span className="font-semibold text-ink">Tiempos y cobros:</span> si cancelas muy tarde (por ejemplo, cuando el
        comercio ya lo está preparando o el repartidor ya va en camino), es posible que no se te reembolse el dinero o que
        se apliquen cargos según los Términos y Condiciones.
      </span>
    </p>
  );
}

/** Solicitud de cancelación de un pedido ya aceptado: la revisa Dfly. */
export function RequestCancelForm({ code }: { code: string }) {
  const [state, action] = useActionState<CancelState, FormData>(requestCancellationAction, {});

  if (state.ok) {
    return (
      <p role="status" className="flex items-start gap-2.5 text-[15px] leading-snug">
        <CheckCircle2 aria-hidden className="mt-0.5 size-5 flex-none text-route-deep" strokeWidth={2.25} />
        <span>
          <span className="font-semibold">Solicitud enviada.</span> La revisamos y te avisamos por WhatsApp si se pudo
          cancelar.
        </span>
      </p>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <input type="hidden" name="code" value={code} />
      <FormError message={state.error} />
      <LateCancelWarning />
      <TextareaField
        label="¿Por qué quieres cancelarlo?"
        name="reason"
        rows={4}
        maxLength={500}
        required
        defaultValue={state.values?.reason}
        placeholder="Ej. Me equivoqué de dirección y ya no estaré en casa."
        error={state.fieldErrors?.reason}
        hint="Lo lee una persona de Dfly. Mínimo 10 caracteres."
      />
      <div className="sm:w-72">
        <SubmitButton pendingLabel="Enviando…">Solicitar cancelación</SubmitButton>
      </div>
    </form>
  );
}
