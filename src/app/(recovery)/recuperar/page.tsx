import type { Metadata } from "next";
import Link from "next/link";
import { ForgotPasswordForm } from "./forgot-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPasswordPage() {
  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[34px] leading-none tracking-[-0.03em]">Recupera tu acceso</h1>
        <p className="text-[15px] text-ink-soft">
          Escribe el correo de tu cuenta y te enviaremos un enlace para elegir una contraseña nueva.
        </p>
      </div>
      <div className="flex flex-col gap-5 rounded-surface bg-surface p-5 shadow-lift ring-1 ring-line sm:p-7">
        <ForgotPasswordForm />
      </div>
      <p className="text-center text-[14.5px] text-ink-soft">
        ¿Ya la recordaste?{" "}
        <Link href="/login" className="font-semibold text-brand underline hover:text-brand-deep">
          Inicia sesión
        </Link>
      </p>
    </div>
  );
}
