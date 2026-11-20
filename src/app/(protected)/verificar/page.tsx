import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { EmailVerification } from "@/components/email-verification";
import { PhoneVerification } from "@/components/phone-verification";
import { safeCallbackUrl } from "@/lib/safe-callback";
import { getVerification } from "@/modules/identity/queries";
import { requireUser } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Verifica tu cuenta" };

/**
 * Se llega aquí al registrarse. Se confirma una sola vez que el correo y el celular son del cliente;
 * sin eso puede navegar y armar su carrito, pero no pedir.
 */
export default async function VerifyPage({ searchParams }: PageProps<"/verificar">) {
  const { callbackUrl } = await searchParams;
  const next = safeCallbackUrl(typeof callbackUrl === "string" ? callbackUrl : undefined) ?? "/comercios";
  const user = await requireUser(`/verificar?callbackUrl=${encodeURIComponent(next)}`);
  const v = await getVerification(user.id);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-4 pt-8 pb-20 sm:px-8 sm:pt-12">
      <div className="flex flex-col gap-2.5">
        <h1 className="font-display text-[32px] leading-none tracking-[-0.03em] text-balance sm:text-[40px]">
          {v.verified ? "Tu cuenta está lista" : "Confirma tus datos"}
        </h1>
        <p className="max-w-[60ch] text-[15px] text-ink-soft">
          {v.verified
            ? "Ya puedes hacer tus pedidos. No tendrás que repetir esto."
            : "Te pedimos dos códigos, uno por correo y otro por WhatsApp, para asegurarnos de que tus datos son correctos. Se hace una sola vez."}
        </p>
      </div>

      <ol className="flex flex-col gap-5">
        <Step n={1} title="Tu correo" done={v.emailVerified}>
          <EmailVerification email={v.email} verified={v.emailVerified} codeAlreadySent={!v.emailVerified} />
        </Step>
        <Step n={2} title="Tu celular" done={v.phoneVerified}>
          <PhoneVerification phone={v.phone ?? ""} verified={v.phoneVerified} pendingPhone={v.pendingPhone} />
        </Step>
      </ol>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        {v.verified ? (
          <Link
            href={next}
            className="press inline-flex h-[52px] items-center justify-center gap-2 rounded-control bg-route px-6 text-[15px] font-bold text-ink no-underline hover:bg-route-deep"
          >
            Continuar
            <ArrowRight aria-hidden className="size-[18px]" strokeWidth={2.25} />
          </Link>
        ) : (
          <>
            <Link
              href={next}
              className="inline-flex min-h-11 items-center text-[14.5px] font-semibold text-brand underline hover:text-brand-deep"
            >
              Hacerlo después
            </Link>
            <p className="text-[13.5px] text-ink-soft">Puedes ver los comercios, pero para pedir necesitas los dos códigos.</p>
          </>
        )}
      </div>
    </main>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <li className={`flex flex-col gap-4 rounded-surface bg-surface p-5 sm:p-7 ${done ? "ring-1 ring-line" : "ring-2 ring-route"}`}>
      <h2 className="flex items-center gap-2.5 text-[17px] font-bold">
        {done ? (
          <CheckCircle2 aria-hidden className="size-5 flex-none text-route-deep" strokeWidth={2.25} />
        ) : (
          <span aria-hidden className="tabular grid size-6 flex-none place-items-center rounded-full bg-ink text-[13px] font-bold text-surface">
            {n}
          </span>
        )}
        {title}
        <span className="sr-only">{done ? " (listo)" : ` (paso ${n} de 2)`}</span>
      </h2>
      {children}
    </li>
  );
}
