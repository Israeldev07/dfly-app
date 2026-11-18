"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { FormError, SubmitButton } from "@/components/forms";
import { sendEmailCodeAction, verifyEmailCodeAction, type EmailVerificationState } from "@/modules/identity/actions";

/** Verificación del email con un código de 6 dígitos que llega al correo. No bloquea los pedidos. */
export function EmailVerification({ email, verified: initialVerified }: { email: string; verified: boolean }) {
  const router = useRouter();
  const [verified, setVerified] = useState(initialVerified);
  const [codeSent, setCodeSent] = useState(false);
  const [sendError, setSendError] = useState<string>();
  const [resentAt, setResentAt] = useState<number | null>(null);
  const [sending, startSend] = useTransition();

  const [state, verifyAction] = useActionState<EmailVerificationState, FormData>(async (prev, formData) => {
    const next = await verifyEmailCodeAction(prev, formData);
    if (next.verified) {
      setVerified(true);
      router.refresh();
    } else if (!next.sent) {
      // Código vencido o sin intentos: hay que pedir otro.
      setCodeSent(false);
      setSendError(next.error);
    }
    return next;
  }, {});

  function send() {
    setSendError(undefined);
    startSend(async () => {
      const res = await sendEmailCodeAction();
      if (res.verified) {
        setVerified(true);
        router.refresh();
        return;
      }
      setSendError(res.error);
      if (res.sent) {
        setCodeSent(true);
        if (!res.error) setResentAt(Date.now());
      }
    });
  }

  if (verified) {
    return (
      <p role="status" className="flex items-center gap-2 text-[15px]">
        <CheckCircle2 aria-hidden className="size-[18px] flex-none text-route-deep" strokeWidth={2.25} />
        <span className="min-w-0 break-all">
          <span className="font-semibold">{email}</span>
          <span className="text-ink-soft"> · verificado</span>
        </span>
      </p>
    );
  }

  if (!codeSent) {
    return (
      <div className="flex flex-col gap-4">
        <FormError message={sendError} />
        <p className="text-[15px] leading-relaxed">
          Confirma que <span className="font-semibold break-all">{email}</span> es tuyo. Te enviaremos un código de 6
          dígitos.
        </p>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={send}
            disabled={sending}
            aria-busy={sending || undefined}
            className="press inline-flex h-[52px] items-center justify-center gap-2 rounded-control bg-route px-6 text-[15px] font-bold text-ink hover:bg-route-deep disabled:cursor-progress disabled:opacity-70"
          >
            {sending ? (
              <LoaderCircle aria-hidden className="size-[18px] animate-spin motion-reduce:animate-none" />
            ) : (
              <Mail aria-hidden className="size-[18px]" strokeWidth={2.25} />
            )}
            {sending ? "Enviando…" : "Enviar código"}
          </button>
          <button
            type="button"
            onClick={() => setCodeSent(true)}
            className="min-h-11 text-[14px] font-semibold text-brand underline underline-offset-2 hover:text-brand-deep"
          >
            Ya tengo un código
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={verifyAction} noValidate className="flex flex-col gap-4">
      <FormError message={sendError ?? state.error} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email-code" className="text-[14px] font-semibold">
          Código de 6 dígitos
        </label>
        <input
          id="email-code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          placeholder="123456"
          aria-describedby="email-code-hint"
          aria-invalid={state.error ? true : undefined}
          className="tabular h-12 w-full max-w-56 rounded-control bg-surface px-4 text-[20px] font-bold tracking-[0.3em] text-ink ring-1 ring-ink/20 transition-shadow duration-150 outline-none placeholder:font-normal placeholder:tracking-[0.3em] placeholder:text-ink-soft hover:ring-ink/35 focus-visible:ring-2 focus-visible:ring-route-deep aria-invalid:ring-2 aria-invalid:ring-brand"
        />
        <p id="email-code-hint" className="text-[13px] text-ink-soft">
          {resentAt ? "Te lo enviamos" : "Lo enviamos"} a <span className="break-all">{email}</span>. Vence en 15 minutos;
          revisa también la carpeta de spam.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="w-full sm:w-56">
          <SubmitButton pendingLabel="Verificando…">Verificar email</SubmitButton>
        </div>
        <button
          type="button"
          onClick={send}
          disabled={sending}
          className="min-h-11 text-[14px] font-semibold text-brand underline underline-offset-2 hover:text-brand-deep disabled:opacity-60"
        >
          {sending ? "Enviando…" : "Reenviar código"}
        </button>
      </div>
    </form>
  );
}
