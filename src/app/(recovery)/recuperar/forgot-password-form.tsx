"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { forgotPasswordAction, type ForgotPasswordState } from "@/modules/identity/password-actions";

export function ForgotPasswordForm() {
  const [state, action] = useActionState<ForgotPasswordState, FormData>(forgotPasswordAction, {});

  if (state.done) {
    return (
      <div role="status" className="flex flex-col gap-3">
        <p className="flex items-center gap-2 text-[16px] font-bold">
          <MailCheck aria-hidden className="size-5 flex-none text-route-deep" strokeWidth={2.25} />
          Revisa tu correo
        </p>
        <p className="text-[15px] leading-relaxed">
          Si <span className="font-semibold [overflow-wrap:anywhere]">{state.values?.email}</span> tiene una cuenta en Dfly, te llegará
          un enlace en unos minutos. Vence en 30 minutos y sirve una sola vez. Si no lo ves, revisa la carpeta de spam.
        </p>
      </div>
    );
  }

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <FormError message={state.error} />
      <Field
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Enviando…">Enviar enlace</SubmitButton>
    </form>
  );
}
