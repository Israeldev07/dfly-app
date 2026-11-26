import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalContact, LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Términos y condiciones",
  description: "Condiciones de uso de Dfly, la plataforma de pedidos y delivery de Otavalo.",
};

const sections: LegalSection[] = [
  {
    id: "quienes-somos",
    title: "Quiénes somos",
    body: (
      <>
        <p>
          {LEGAL.brand} ({LEGAL.site}) es una plataforma de pedidos y delivery en Otavalo, operada por{" "}
          <strong>{LEGAL.owner}</strong>. A través de {LEGAL.brand} puedes pedir productos de restaurantes, market,
          farmacia, bebidas y mascotas, y nosotros te los llevamos.
        </p>
        <LegalContact />
      </>
    ),
  },
  {
    id: "aceptacion",
    title: "Aceptación",
    body: (
      <p>
        Al crear una cuenta o hacer un pedido aceptas estos términos y declaras haber leído la{" "}
        <Link href="/privacidad">Política de privacidad</Link>. Si no estás de acuerdo, no uses la plataforma.
      </p>
    ),
  },
  {
    id: "cuenta",
    title: "Tu cuenta",
    body: (
      <ul>
        <li>Debes ser mayor de 18 años.</li>
        <li>
          Los datos que registres (nombre, correo, celular y direcciones) deben ser reales y estar actualizados. Para
          pedir debes verificar tu correo y tu celular con el código que te enviamos.
        </li>
        <li>
          Eres responsable de mantener tu contraseña en secreto y de lo que se haga desde tu cuenta. Si crees que
          alguien más la usa, cambia tu contraseña y avísanos.
        </li>
      </ul>
    ),
  },
  {
    id: "pedidos",
    title: "Cómo funciona un pedido",
    body: (
      <ul>
        <li>Eliges los productos de un comercio y confirmas el pedido en el checkout.</li>
        <li>
          Enviamos el pedido al comercio, que decide si puede prepararlo. Te avisamos por WhatsApp si lo acepta o lo
          rechaza, y puedes seguir su estado en la página del pedido.
        </li>
        <li>
          Si el comercio no responde a tiempo, el pedido vence y no se prepara. Si lo rechaza o vence, no se te cobra
          nada.
        </li>
        <li>
          Al crear tu cuenta aceptas recibir estos avisos por WhatsApp. Sin ellos no podemos confirmarte el estado de
          tus pedidos.
        </li>
      </ul>
    ),
  },
  {
    id: "precios",
    title: "Precios y pagos",
    body: (
      <ul>
        <li>
          Los precios están en dólares de los Estados Unidos (USD) e incluyen lo que el comercio cobra por cada
          producto y sus opciones. El costo de envío se muestra en el checkout antes de confirmar.
        </li>
        <li>
          El total que se cobra es el que ves al confirmar el pedido, calculado con los precios vigentes en ese
          momento.
        </li>
        <li>
          Pagas en <strong>efectivo</strong> al recibir el pedido o por <strong>transferencia</strong>.{" "}
          {LEGAL.brand} no cobra con tarjeta ni guarda datos de tarjetas o cuentas bancarias.
        </li>
      </ul>
    ),
  },
  {
    id: "cancelaciones",
    title: "Cancelaciones",
    body: (
      <ul>
        <li>
          Mientras el comercio no haya aceptado el pedido, puedes cancelarlo al instante desde la página del pedido,
          sin costo.
        </li>
        <li>
          Si el comercio ya lo aceptó, ya lo está preparando: puedes solicitar la cancelación en el{" "}
          <Link href="/ayuda">Centro de ayuda</Link> indicando el motivo. La revisamos y te respondemos; puede ser
          rechazada si el pedido ya está preparado o en camino.
        </li>
        <li>
          {LEGAL.brand} puede cancelar un pedido si no puede entregarlo (por ejemplo, fuera de la zona de cobertura o
          sin datos de contacto válidos). En ese caso te avisamos y no se te cobra nada.
        </li>
      </ul>
    ),
  },
  {
    id: "entregas",
    title: "Entregas",
    body: (
      <ul>
        <li>Entregamos en Otavalo y en las zonas de cobertura que indiquemos.</li>
        <li>
          Los tiempos de entrega son estimados y pueden variar por la preparación del comercio, el tráfico o el clima.
        </li>
        <li>
          Debes indicar una dirección correcta con referencias, y estar disponible en tu celular para recibir el
          pedido.
        </li>
        <li>
          Los productos que la ley restringe (como bebidas alcohólicas o medicamentos que requieren receta) solo se
          entregan si cumples los requisitos legales; podemos pedirte una identificación o la receta al entregar.
        </li>
      </ul>
    ),
  },
  {
    id: "productos",
    title: "Productos y comercios",
    body: (
      <p>
        Cada comercio es responsable de los productos que ofrece: su calidad, preparación, ingredientes, estado y
        disponibilidad. Si recibes un producto en mal estado o incompleto, escríbenos lo antes posible y lo gestionamos
        con el comercio. Las fotos y descripciones son referenciales.
      </p>
    ),
  },
  {
    id: "uso",
    title: "Uso correcto de la plataforma",
    body: (
      <>
        <p>No está permitido:</p>
        <ul>
          <li>Hacer pedidos falsos o con datos de otra persona sin su autorización.</li>
          <li>Intentar acceder a cuentas ajenas o a partes de la plataforma sin permiso.</li>
          <li>Usar la plataforma para fines ilegales o para dañar a {LEGAL.brand}, a los comercios o a otros usuarios.</li>
          <li>Tratar de forma abusiva al personal de reparto o de los comercios.</li>
        </ul>
        <p>Si esto ocurre, podemos suspender o cerrar la cuenta.</p>
      </>
    ),
  },
  {
    id: "responsabilidad",
    title: "Responsabilidad",
    body: (
      <p>
        Hacemos lo posible para que la plataforma funcione sin interrupciones y para que tus pedidos lleguen bien y a
        tiempo, pero puede haber fallas técnicas o demoras ajenas a nosotros. Nada de lo dispuesto en estos términos
        limita los derechos que te reconoce la Ley Orgánica de Defensa del Consumidor del Ecuador.
      </p>
    ),
  },
  {
    id: "cambios",
    title: "Cambios en estos términos",
    body: (
      <p>
        Podemos actualizar estos términos. Publicaremos la nueva versión aquí con su fecha y, si el cambio es
        importante, te lo avisaremos. Los pedidos ya hechos se rigen por los términos vigentes cuando los hiciste.
      </p>
    ),
  },
  {
    id: "ley",
    title: "Ley aplicable",
    body: (
      <p>
        Estos términos se rigen por las leyes de la República del Ecuador. Antes de acudir a otra vía, escríbenos:
        intentaremos resolver cualquier problema de forma directa. Si no fuera posible, serán competentes los jueces de
        Otavalo, sin perjuicio de los derechos que la ley te reconozca como consumidor.
      </p>
    ),
  },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Términos y condiciones"
      intro={<p>Estas son las reglas para usar {LEGAL.brand}. Las escribimos en lenguaje claro: léelas antes de pedir.</p>}
      sections={sections}
    />
  );
}
