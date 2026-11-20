import type { Metadata } from "next";
import { EmailVerification } from "@/components/email-verification";
import { PhoneVerification } from "@/components/phone-verification";
import { getCheckoutProfile } from "@/modules/identity/queries";
import { requireUser } from "@/modules/identity/session";
import { deliveryFeeCents } from "@/modules/ordering/domain";
import { CheckoutForm } from "./checkout-form";

export const metadata: Metadata = { title: "Confirmar pedido" };

export default async function CheckoutPage() {
  const user = await requireUser("/checkout");
  const profile = await getCheckoutProfile(user.id);
  const { email, emailVerified, phone, phoneVerified, pendingPhone, address } = profile;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-4 pt-8 pb-20 sm:px-8 sm:pt-12">
      <h1 className="font-display text-[32px] leading-none tracking-[-0.03em] sm:text-[40px]">Confirma tu pedido</h1>
      <div className="grid gap-8 lg:grid-cols-[1fr_380px]">
        {emailVerified ? null : (
          <section
            aria-labelledby="email-heading"
            className="flex flex-col gap-4 rounded-surface bg-surface p-5 ring-2 ring-route sm:p-7 lg:col-start-1"
          >
            <div className="flex flex-col gap-1">
              <h2 id="email-heading" className="text-[18px] font-bold">
                Primero, verifica tu correo
              </h2>
              <p className="text-[14px] text-ink-soft">Se hace una sola vez.</p>
            </div>
            <EmailVerification email={email} verified={false} />
          </section>
        )}
        <section
          aria-labelledby="phone-heading"
          className={`flex flex-col gap-4 rounded-surface bg-surface p-5 sm:p-7 lg:col-start-1 ${phoneVerified ? "ring-1 ring-line" : "ring-2 ring-route"}`}
        >
          <div className="flex flex-col gap-1">
            <h2 id="phone-heading" className="text-[18px] font-bold">
              {phoneVerified ? "Te avisamos por WhatsApp" : "Verifica tu celular"}
            </h2>
            {phoneVerified ? null : (
              <p className="text-[14px] text-ink-soft">
                Solo te escribimos a un número que confirmaste que es tuyo. Se hace una sola vez.
              </p>
            )}
          </div>
          <PhoneVerification phone={phone ?? ""} verified={phoneVerified} pendingPhone={pendingPhone} />
        </section>
      </div>
      <CheckoutForm
        deliveryFeeCents={deliveryFeeCents()}
        phoneVerified={phoneVerified}
        emailVerified={emailVerified}
        defaults={{
          addressLine: address?.line ?? "",
          sector: address?.sector ?? "",
          reference: address?.reference ?? "",
        }}
      />
    </main>
  );
}
