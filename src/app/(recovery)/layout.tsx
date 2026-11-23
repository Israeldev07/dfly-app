import { AuthBackdrop } from "@/components/auth-backdrop";

/**
 * Mismo marco que login y registro, pero sin redirigir con la sesión iniciada: quien abre el enlace de
 * recuperación en un dispositivo donde ya tenía sesión debe poder cambiar la contraseña igual.
 */
export default function RecoveryLayout({ children }: LayoutProps<"/">) {
  return (
    <AuthBackdrop className="items-start justify-center px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-[440px] rounded-surface bg-surface p-6 shadow-pop sm:p-8">{children}</div>
    </AuthBackdrop>
  );
}
