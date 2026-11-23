import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthBackdrop } from "@/components/auth-backdrop";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  // Aquí y no en el proxy: `auth()` comprueba en la base de datos que la sesión no se haya anulado.
  if ((await auth())?.user) redirect("/comercios");

  return (
    <AuthBackdrop className="items-start justify-center px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-[440px] rounded-surface bg-surface p-6 shadow-pop sm:p-8">{children}</div>
    </AuthBackdrop>
  );
}
