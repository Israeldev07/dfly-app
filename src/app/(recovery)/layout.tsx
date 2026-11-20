/**
 * Mismo marco que login y registro, pero sin redirigir con la sesión iniciada: quien abre el enlace de
 * recuperación en un dispositivo donde ya tenía sesión debe poder cambiar la contraseña igual.
 */
export default function RecoveryLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
      <div className="w-full max-w-[420px]">{children}</div>
    </main>
  );
}
