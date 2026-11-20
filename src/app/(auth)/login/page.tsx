import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { safeCallbackUrl } from "@/lib/safe-callback";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { callbackUrl, restablecida } = await searchParams;
  const next = safeCallbackUrl(typeof callbackUrl === "string" ? callbackUrl : undefined);

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[34px] leading-none tracking-[-0.03em]">Hola de nuevo</h1>
        <p className="text-[15px] text-ink-soft">Entra para ver los comercios de Otavalo y hacer tu pedido.</p>
      </div>
      <div className="flex flex-col gap-5 rounded-surface bg-surface p-5 shadow-lift ring-1 ring-line sm:p-7">
        {restablecida === "1" ? (
          <p role="status" className="flex items-center gap-2 text-[14.5px] font-medium text-route-deep">
            <CheckCircle2 aria-hidden className="size-[18px] flex-none" strokeWidth={2.25} />
            Contraseña actualizada. Entra con la nueva.
          </p>
        ) : null}
        <LoginForm callbackUrl={next} />
      </div>
      <p className="text-center text-[14.5px] text-ink-soft">
        ¿Aún no tienes cuenta?{" "}
        <Link
          href={next ? `/registro?callbackUrl=${encodeURIComponent(next)}` : "/registro"}
          className="font-semibold text-brand underline hover:text-brand-deep"
        >
          Crea una gratis
        </Link>
      </p>
    </div>
  );
}
