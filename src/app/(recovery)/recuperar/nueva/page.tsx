import type { Metadata } from "next";
import Link from "next/link";
import { isResetTokenValid } from "@/modules/identity/password-reset";
import { ResetPasswordForm } from "./reset-password-form";

// `no-referrer`: el token va en la URL y no debe salir hacia otros sitios.
export const metadata: Metadata = { title: "Nueva contraseña", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/recuperar/nueva">) {
  const { token } = await searchParams;
  const valid = await isResetTokenValid(token);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[34px] leading-none tracking-[-0.03em]">
          {valid ? "Elige una contraseña nueva" : "Este enlace ya no sirve"}
        </h1>
        <p className="text-[15px] text-ink-soft">
          {valid
            ? "Al guardarla se cerrarán las sesiones abiertas en todos tus dispositivos."
            : "Los enlaces vencen a los 30 minutos y sirven una sola vez. Pide uno nuevo."}
        </p>
      </div>
      <div className="flex flex-col gap-5">
        {valid && typeof token === "string" ? (
          <ResetPasswordForm token={token} />
        ) : (
          <Link
            href="/recuperar"
            className="press inline-flex h-[52px] items-center justify-center rounded-control bg-route px-6 text-[15px] font-bold text-ink no-underline hover:bg-route-deep"
          >
            Pedir un enlace nuevo
          </Link>
        )}
      </div>
    </div>
  );
}
