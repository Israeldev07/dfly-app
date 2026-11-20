"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { resetPasswordAction, type ResetPasswordState } from "@/modules/identity/password-actions";

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<ResetPasswordState, FormData>(resetPasswordAction, {});
  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      {state.error ? (
        <div className="flex flex-col gap-2">
          <FormError message={state.error} />
          <Link href="/recuperar" className="w-fit text-[14px] font-semibold text-brand underline hover:text-brand-deep">
            Pedir un enlace nuevo
          </Link>
        </div>
      ) : null}
      <input type="hidden" name="token" value={token} />
      <Field
        label="Contraseña nueva"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={8}
        error={state.fieldErrors?.password}
        hint="Mínimo 8 caracteres."
      />
      <Field
        label="Repite la contraseña"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={state.fieldErrors?.confirm}
      />
      <SubmitButton pendingLabel="Guardando…">Guardar contraseña</SubmitButton>
    </form>
  );
}
