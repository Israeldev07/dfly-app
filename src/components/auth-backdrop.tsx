import Image from "next/image";
import type { ReactNode } from "react";
import fondo from "../../public/auth/login.webp";

/**
 * Fondo de login, registro, recuperar y verificar: comida en los bordes y el centro azul libre para la
 * tarjeta. El color de respaldo es el azul de la foto, para que no se vea un salto mientras carga.
 */
export function AuthBackdrop({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <main className={`relative isolate flex flex-1 bg-[#1faadb] ${className}`}>
      <Image src={fondo} alt="" fill preload sizes="100vw" placeholder="blur" className="-z-10 object-cover" />
      {children}
    </main>
  );
}
