"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, Mail } from "lucide-react";
import { CodeField, LinkButton } from "@/components/code-field";
import { FormError, SubmitButton } from "@/components/forms";
import { sendEmailCodeAction, verifyEmailCodeAction } from "@/modules/identity/email-actions";
import type { CodeState } from "@/modules/identity/form-errors";

type Props = {
  email: string;
  verified: boolean;
  /** Tras registrarse el código ya salió: se muestra directamente el campo para escribirlo. */
  codeAlreadySent?: boolean;
};

/** Verificación del correo con un código de 6 dígitos (se hace una sola vez). */
export function EmailVerification({ email, verified: initialVerified, codeAlreadySent = false }: Props) {
  const router = useRouter();
  const [verified, setVerified] = useState(initialVerified);
  const [codeSent, setCodeSent] = useState(codeAlreadySent);
  const [sendError, setSendError] = useState<string>();
  const [resent, setResent] = useState(false);
  const [sending, startSend] = useTransition();

  const [state, verifyAction] = useActionState<CodeState, FormData>(async (prev, formData) => {
    setSendError(undefined);
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
      const res = await sendEmailCodeAction().catch(() => ({ error: "Sin conexión. Revisa tu internet e inténtalo de nuevo." }) as CodeState);
      if (res.verified) {
        setVerified(true);
        router.refresh();
        return;
      }
      setSendError(res.error);
      if (res.sent) {
        if (codeSent && !res.error) setResent(true);
        setCodeSent(true);
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
          Te enviaremos un código de 6 dígitos a <span className="font-semibold break-all">{email}</span>.
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
          <LinkButton onClick={() => setCodeSent(true)}>Ya tengo un código</LinkButton>
        </div>
      </div>
    );
  }

  return (
    <form action={verifyAction} noValidate className="flex flex-col gap-4">
      <FormError message={sendError ?? state.error} />
      <CodeField
        id="email-code"
        error={state.error}
        hint={
          <>
            {resent ? "Te enviamos uno nuevo" : "Lo enviamos"} a <span className="break-all">{email}</span>. Vence en 15
            minutos; si no llega, revisa la carpeta de spam.
          </>
        }
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="w-full sm:w-56">
          <SubmitButton pendingLabel="Verificando…">Verificar correo</SubmitButton>
        </div>
        <LinkButton onClick={send} disabled={sending}>
          {sending ? "Enviando…" : "Reenviar código"}
        </LinkButton>
      </div>
    </form>
  );
}
