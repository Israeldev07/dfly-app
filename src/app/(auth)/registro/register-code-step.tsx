"use client";

import { useActionState, useState, useTransition } from "react";
import { MailCheck } from "lucide-react";
import { CodeField, LinkButton } from "@/components/code-field";
import { FormError, SubmitButton } from "@/components/forms";
import {
  confirmRegistrationAction,
  resendRegistrationCodeAction,
  type RegisterState,
} from "@/modules/identity/auth-actions";

type Props = {
  pending: NonNullable<RegisterState["pending"]>;
  callbackUrl?: string;
  onChangeEmail: () => void;
};

/**
 * Paso 2 del registro. Se ve igual exista o no la cuenta: si el correo ya estaba registrado, al dueño le
 * llegó un aviso para recuperar el acceso y aquí ningún código funciona.
 */
export function RegisterCodeStep({ pending, callbackUrl, onChangeEmail }: Props) {
  const [state, action] = useActionState<RegisterState, FormData>(confirmRegistrationAction, { pending });
  const [resending, startResend] = useTransition();
  const [resendState, setResendState] = useState<"idle" | "sent" | "error">("idle");

  function resend() {
    startResend(async () => {
      const res = await resendRegistrationCodeAction({ pending }).catch(() => null);
      setResendState(res?.resent ? "sent" : "error");
    });
  }

  const error = resendState === "error" ? "Sin conexión. Revisa tu internet e inténtalo de nuevo." : state.error;

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <div role="status" className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-[16px] font-bold">
          <MailCheck aria-hidden className="size-5 flex-none text-route-deep" strokeWidth={2.25} />
          Revisa tu correo
        </p>
        <p className="text-[15px] leading-relaxed">
          Enviamos un código de 6 dígitos a <span className="font-semibold [overflow-wrap:anywhere]">{pending.email}</span>. Escríbelo
          para entrar.
        </p>
      </div>
      <FormError message={error} />
      {callbackUrl ? <input type="hidden" name="callbackUrl" value={callbackUrl} /> : null}
      <CodeField
        id="register-code"
        error={state.error}
        hint={
          resendState === "sent"
            ? "Te enviamos otro código. Vence en 15 minutos; si no llega, revisa la carpeta de spam."
            : "Vence en 15 minutos. Si no llega, revisa la carpeta de spam. Si ya tenías una cuenta con este correo, te enviamos en su lugar un enlace para recuperar el acceso."
        }
      />
      <SubmitButton pendingLabel="Verificando…">Verificar y entrar</SubmitButton>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <LinkButton onClick={resend} disabled={resending}>
          {resending ? "Enviando…" : "Reenviar código"}
        </LinkButton>
        <LinkButton onClick={onChangeEmail}>Usar otro correo</LinkButton>
      </div>
    </form>
  );
}
