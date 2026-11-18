"use client";

import { useActionState } from "react";
import { CheckCircle2 } from "lucide-react";
import { Field, SubmitButton } from "@/components/forms";
import { updateProfileAction, type ProfileState } from "@/modules/identity/actions";

export function ProfileForm({ name }: { name: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfileAction, {});
  const v = { name, ...state.values };

  return (
    <form action={action} noValidate className="flex flex-col gap-4">
      <Field label="Nombre" name="name" autoComplete="name" defaultValue={v.name} required error={state.fieldErrors?.name} />
      {state.ok ? (
        <p role="status" className="flex items-center gap-2 text-[14px] font-medium text-route-deep">
          <CheckCircle2 aria-hidden className="size-4" strokeWidth={2.25} />
          Datos guardados.
        </p>
      ) : null}
      <div className="sm:w-56">
        <SubmitButton pendingLabel="Guardando…">Guardar cambios</SubmitButton>
      </div>
    </form>
  );
}
