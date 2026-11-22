import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/admin-nav";
import { requireAdmin } from "@/modules/identity/session";

// Función y no constante: así el 404 de quien no es admin tampoco lleva el título del panel.
export async function generateMetadata(): Promise<Metadata> {
  await requireAdmin("/admin");
  return {
    title: { default: "Panel", template: "%s · Panel Dfly" },
    robots: { index: false, follow: false },
  };
}

// El layout verifica el rol para que quien no es admin reciba el 404 sin ver la navegación del panel.
// Cada página lo verifica también: el layout no se vuelve a ejecutar al navegar dentro del panel.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin("/admin");
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 pt-6 pb-20 sm:px-8 sm:pt-8">
      <AdminNav />
      {children}
    </div>
  );
}
