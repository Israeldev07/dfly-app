"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { CodeField, LinkButton } from "@/components/code-field";
import { Field, FormError, SubmitButton } from "@/components/forms";
import { displayPhone } from "@/modules/identity/account-rules";
import { sendPhoneCodeAction, verifyPhoneCodeAction, type PhoneCodeState } from "@/modules/identity/phone-actions";

type Props = {
  /** Celular guardado (E.164) o vacío. */
  phone: string;
  verified: boolean;
  /** Número al que ya se envió un código vigente (al volver a la página). */
  pendingPhone?: string | null;
};

/**
 * Verificación del celular: Dfly envía un código por WhatsApp y el cliente lo escribe aquí.
 * El número guardado solo cambia cuando el código es correcto.
 */
export function PhoneVerification({ phone, verified: initialVerified, pendingPhone = null }: Props) {
  const router = useRouter();
  const [verified, setVerified] = useState(initialVerified);
  const [editing, setEditing] = useState(!initialVerified);
  // Número al que salió el código que se está esperando; null = mostrar el formulario del número.
  const [sentTo, setSentTo] = useState<string | null>(initialVerified ? null : pendingPhone);
  const [typedPhone, setTypedPhone] = useState(pendingPhone ?? phone);

  const [sendState, sendAction] = useActionState<PhoneCodeState, FormData>(async (prev, formData) => {
    const next = await sendPhoneCodeAction(prev, formData);
    if (next.values?.phone) setTypedPhone(next.values.phone);
    if (next.verified) {
      // Era el mismo número ya verificado: no hace falta código.
      setVerified(true);
      setEditing(false);
      router.refresh();
    } else if (next.sent && next.phone) {
      setSentTo(next.phone);
    }
    return next;
  }, {});

  const [codeState, verifyAction] = useActionState<PhoneCodeState, FormData>(async (prev, formData) => {
    const next = await verifyPhoneCodeAction({ ...prev, phone: sentTo ?? undefined }, formData);
    if (next.verified) {
      setVerified(true);
      setEditing(false);
      setSentTo(null);
      router.refresh();
    } else if (!next.sent) {
      // Vencido o sin intentos: vuelve al número para pedir otro.
      setSentTo(null);
    }
    return next;
  }, {});

  const shownPhone = verified && sentTo === null ? (codeState.phone ?? phone) : phone;

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
        <LinkButton onClick={() => setEditing(true)}>Cambiar número</LinkButton>
      </div>
    );
  }

  if (sentTo) {
    return (
      <form action={verifyAction} noValidate className="flex flex-col gap-4">
        <FormError message={codeState.error} />
        <CodeField
          id="phone-code"
          error={codeState.error}
          hint={
            <>
              Te lo enviamos por WhatsApp al{" "}
              <span className="tabular font-semibold whitespace-nowrap">{displayPhone(sentTo)}</span>. Vence en 10 minutos.
            </>
          }
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="w-full sm:w-56">
            <SubmitButton pendingLabel="Verificando…">Verificar celular</SubmitButton>
          </div>
          <LinkButton onClick={() => setSentTo(null)}>Reenviar o cambiar número</LinkButton>
        </div>
      </form>
    );
  }

  const expiredError = codeState.error && !codeState.sent ? codeState.error : undefined;
  return (
    <form action={sendAction} noValidate className="flex flex-col gap-4">
      <FormError message={sendState.error ?? expiredError} />
      <Field
        label="Celular (WhatsApp)"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="099 123 4567"
        defaultValue={typedPhone.replace(/^\+593/, "0")}
        key={typedPhone}
        required
        error={sendState.fieldErrors?.phone}
        hint="Te enviaremos un código por WhatsApp. Ahí mismo te avisaremos del estado de tus pedidos; el comercio nunca ve tu número."
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="w-full sm:w-72">
          <SubmitButton pendingLabel="Enviando código…">
            <MessageCircle aria-hidden className="size-[18px]" strokeWidth={2.25} />
            Enviar código por WhatsApp
          </SubmitButton>
        </div>
        {verified ? <LinkButton onClick={() => setEditing(false)}>Mantener el número actual</LinkButton> : null}
      </div>
    </form>
  );
}
