"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, MessageCircle } from "lucide-react";
import { Field, FormError, SubmitButton } from "@/components/forms";
import {
  phoneVerificationStatusAction,
  simulatePhoneVerificationAction,
  startPhoneVerificationAction,
  type PhoneVerificationState,
} from "@/modules/identity/actions";

type Props = {
  /** Celular guardado en formato local ("0991234567") o vacío. */
  phone: string;
  verified: boolean;
  /** Solo en desarrollo, sin WhatsApp real: botón para simular el mensaje. */
  allowSimulate?: boolean;
};

const POLL_MS = 3000;

/** "0991234567" o "+593991234567" → "099 123 4567". */
function displayPhone(phone: string) {
  const local = phone.replace(/^\+593/, "0").replace(/\D/g, "");
  return local.length === 10 ? `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}` : phone;
}

/**
 * El cliente demuestra que el celular es suyo escribiéndonos por WhatsApp: Dfly nunca
 * escribe primero a un número sin verificar. Mientras espera, consulta el estado.
 */
export function PhoneVerification({ phone, verified: initialVerified, allowSimulate = false }: Props) {
  const router = useRouter();
  const [verified, setVerified] = useState(initialVerified);
  const [editing, setEditing] = useState(!initialVerified);
  const [state, action] = useActionState<PhoneVerificationState, FormData>(async (prev, formData) => {
    const next = await startPhoneVerificationAction(prev, formData);
    // El número ya estaba verificado (mismo celular): no hace falta código.
    if (next.verified) {
      setVerified(true);
      setEditing(false);
      router.refresh();
    }
    return next;
  }, {});
  const [dismissedCode, setDismissedCode] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [simulating, startSimulate] = useTransition();

  const pending = state.pending && state.pending.code !== dismissedCode && !verified ? state.pending : null;
  const expired = pending ? new Date(pending.expiresAt).getTime() <= now : false;

  // Espera el mensaje: consulta cada pocos segundos y al volver de WhatsApp.
  useEffect(() => {
    if (!pending || expired) return;
    let cancelled = false;
    async function check() {
      const res = await phoneVerificationStatusAction().catch(() => null);
      if (cancelled) return;
      setNow(Date.now());
      if (res?.verified) {
        setVerified(true);
        setEditing(false);
        router.refresh();
      }
    }
    const timer = setInterval(check, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [pending, expired, router]);

  const shownPhone = pending?.phone ?? state.values?.phone ?? phone;

  if (verified && !editing) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p role="status" className="flex items-center gap-2 text-[15px]">
          <CheckCircle2 aria-hidden className="size-[18px] flex-none text-route-deep" strokeWidth={2.25} />
          <span>
            <span className="tabular font-semibold">{displayPhone(shownPhone)}</span>
            <span className="text-ink-soft"> · verificado</span>
          </span>
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="min-h-11 text-[14px] font-semibold text-brand underline underline-offset-2 hover:text-brand-deep"
        >
          Cambiar número
        </button>
      </div>
    );
  }

  if (pending && !expired) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-[15px] leading-relaxed">
          Envíanos este mensaje desde el WhatsApp de{" "}
          <span className="tabular font-semibold whitespace-nowrap">{displayPhone(pending.phone)}</span>:
        </p>
        <p className="rounded-control bg-ink/[0.04] px-4 py-3 text-[15px] ring-1 ring-line">
          Verificar Dfly: <span className="font-mono text-[16px] font-bold tracking-[0.12em]">{pending.code}</span>
        </p>
        {pending.link ? (
          <a
            href={pending.link}
            target="_blank"
            rel="noopener noreferrer"
            className="press inline-flex h-[52px] items-center justify-center gap-2 rounded-control bg-route px-6 text-[15px] font-bold text-ink no-underline hover:bg-route-deep"
          >
            <MessageCircle aria-hidden className="size-[18px]" strokeWidth={2.25} />
            Abrir WhatsApp con el mensaje listo
          </a>
        ) : null}
        <p role="status" className="flex items-center gap-2 text-[14px] text-ink-soft">
          <LoaderCircle aria-hidden className="size-4 flex-none animate-spin motion-reduce:animate-none" />
          Esperando tu mensaje. Esta página se actualiza sola.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={() => {
              setDismissedCode(pending.code);
              setEditing(true);
            }}
            className="min-h-11 text-[14px] font-semibold text-brand underline underline-offset-2 hover:text-brand-deep"
          >
            Usar otro número
          </button>
          {allowSimulate ? (
            <button
              type="button"
              disabled={simulating}
              onClick={() =>
                startSimulate(async () => {
                  const res = await simulatePhoneVerificationAction(pending.code);
                  if (res.verified) {
                    setVerified(true);
                    setEditing(false);
                    router.refresh();
                  }
                })
              }
              className="min-h-11 rounded-control border border-dashed border-ink/30 px-3 text-[13px] font-semibold text-ink-soft hover:text-ink disabled:opacity-60"
            >
              {simulating ? "Simulando…" : "Simular mensaje (solo desarrollo)"}
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={expired ? "El código venció. Pide uno nuevo." : state.error} />
      <Field
        label="Celular (WhatsApp)"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="099 123 4567"
        defaultValue={shownPhone.replace(/^\+593/, "0")}
        required
        error={state.fieldErrors?.phone}
        hint="Para avisarte de tu pedido, confirma que este número es tuyo enviándonos un WhatsApp. Al hacerlo aceptas recibir ahí los avisos de tus pedidos."
      />
      <div className="sm:w-72">
        <SubmitButton pendingLabel="Preparando…">
          <MessageCircle aria-hidden className="size-[18px]" strokeWidth={2.25} />
          Verificar por WhatsApp
        </SubmitButton>
      </div>
    </form>
  );
}
