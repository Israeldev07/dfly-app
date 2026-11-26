import type { Metadata } from "next";
import Link from "next/link";
import { LEGAL, LegalContact, LegalPage, type LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Política de privacidad",
  description: "Cómo Dfly trata tus datos personales conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador.",
};

const sections: LegalSection[] = [
  {
    id: "responsable",
    title: "Responsable del tratamiento",
    body: (
      <>
        <p>
          El responsable del tratamiento de tus datos personales es <strong>{LEGAL.owner}</strong>, que opera la
          plataforma de pedidos y delivery <strong>{LEGAL.brand}</strong> ({LEGAL.site}).
        </p>
        <LegalContact />
      </>
    ),
  },
  {
    id: "datos",
    title: "Qué datos recogemos",
    body: (
      <>
        <p>Solo recogemos los datos necesarios para que puedas hacer pedidos y recibirlos:</p>
        <ul>
          <li>
            <strong>Datos de tu cuenta:</strong> nombre, correo electrónico, número de celular y contraseña. La
            contraseña se guarda transformada con un algoritmo de un solo sentido; nadie, ni siquiera Dfly, puede
            leerla.
          </li>
          <li>
            <strong>Datos de entrega:</strong> las direcciones que guardas o escribes al pedir (calle, sector y
            referencias).
          </li>
          <li>
            <strong>Datos de tus pedidos:</strong> comercio, productos, opciones elegidas, indicaciones, forma de pago
            (efectivo o transferencia), montos, estado del pedido y fechas, y el motivo si solicitas una cancelación.
          </li>
          <li>
            <strong>Datos técnicos:</strong> la dirección IP desde la que te conectas, que usamos solo de forma
            temporal para limitar intentos de acceso y proteger tu cuenta; y una cookie de sesión para mantenerte
            conectado.
          </li>
        </ul>
        <p>
          <strong>No recogemos</strong> datos de tarjetas de crédito o débito ni datos bancarios: los pagos son en
          efectivo al recibir o por transferencia. Tampoco recogemos tu ubicación GPS ni datos sensibles (salud,
          origen étnico, creencias u otros).
        </p>
      </>
    ),
  },
  {
    id: "finalidades",
    title: "Para qué usamos tus datos",
    body: (
      <ul>
        <li>Crear y administrar tu cuenta, y verificar tu correo y tu celular con un código.</li>
        <li>Recibir tus pedidos, enviarlos al comercio, coordinar la entrega y cobrarla.</li>
        <li>
          Enviarte por WhatsApp y por correo los avisos de tus pedidos: confirmación, rechazo, cancelación y códigos de
          verificación.
        </li>
        <li>Atender tus consultas, solicitudes de cancelación y reclamos.</li>
        <li>Proteger la plataforma: evitar accesos indebidos, pedidos falsos y abusos.</li>
        <li>Cumplir las obligaciones legales, tributarias y contables que nos correspondan.</li>
      </ul>
    ),
  },
  {
    id: "base-legal",
    title: "Base legal",
    body: (
      <>
        <p>
          Tratamos tus datos conforme a la Ley Orgánica de Protección de Datos Personales del Ecuador (LOPDP), con las
          siguientes bases:
        </p>
        <ul>
          <li>
            <strong>Ejecución del contrato:</strong> para crear tu cuenta y gestionar y entregar tus pedidos según
            los <Link href="/terminos">Términos y condiciones</Link>.
          </li>
          <li>
            <strong>Consentimiento:</strong> para enviarte avisos por WhatsApp, que aceptas expresamente al crear tu
            cuenta. Puedes retirarlo cuando quieras (ver la sección de derechos); sin esos avisos no podremos
            confirmarte el estado de tus pedidos.
          </li>
          <li>
            <strong>Interés legítimo:</strong> para la seguridad de la plataforma y la prevención de fraude.
          </li>
          <li>
            <strong>Obligación legal:</strong> para conservar los registros que exijan las normas tributarias y
            comerciales.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "destinatarios",
    title: "Con quién compartimos tus datos",
    body: (
      <>
        <p>No vendemos ni alquilamos tus datos. Solo los compartimos en estos casos:</p>
        <ul>
          <li>
            <strong>Comercios:</strong> reciben únicamente los productos, opciones e indicaciones de tu pedido para
            prepararlo. <strong>No reciben</strong> tu nombre, tu celular ni tu dirección.
          </li>
          <li>
            <strong>Personal de reparto de Dfly:</strong> recibe tu nombre, celular y dirección para entregarte el
            pedido.
          </li>
          <li>
            <strong>Proveedores que nos prestan servicios</strong> (encargados del tratamiento), que solo pueden usar
            los datos para prestarnos ese servicio:
            <ul>
              <li>Meta Platforms (WhatsApp Business), para enviarte los avisos por WhatsApp.</li>
              <li>Vercel Inc., que aloja la web de Dfly.</li>
              <li>Supabase Inc., que aloja la base de datos y las imágenes de la plataforma.</li>
              <li>Nuestro proveedor de correo electrónico, para enviarte códigos y avisos.</li>
            </ul>
          </li>
          <li>
            <strong>Autoridades:</strong> cuando una ley o una orden judicial o administrativa lo exija.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "transferencias",
    title: "Transferencias internacionales",
    body: (
      <p>
        Los proveedores mencionados almacenan o procesan los datos en servidores fuera del Ecuador, principalmente en
        los Estados Unidos. Elegimos proveedores que ofrecen garantías contractuales de protección de datos y
        medidas de seguridad reconocidas, y la transferencia se limita a lo necesario para prestarte el servicio. Al
        usar Dfly, se te informa de esta transferencia conforme a la LOPDP.
      </p>
    ),
  },
  {
    id: "conservacion",
    title: "Cuánto tiempo guardamos tus datos",
    body: (
      <ul>
        <li>Los datos de tu cuenta y tus direcciones, mientras tu cuenta esté activa.</li>
        <li>
          Los registros de tus pedidos, por el plazo que exijan las normas tributarias y comerciales; después se
          eliminan o anonimizan.
        </li>
        <li>
          Los códigos de verificación se borran al usarse o vencer (minutos), y los registros de intentos por IP, al
          terminar su ventana de tiempo.
        </li>
      </ul>
    ),
  },
  {
    id: "derechos",
    title: "Tus derechos",
    body: (
      <>
        <p>Conforme a la LOPDP, puedes ejercer en cualquier momento tus derechos de:</p>
        <ul>
          <li>Información sobre el tratamiento de tus datos.</li>
          <li>Acceso a los datos que tenemos sobre ti.</li>
          <li>Rectificación y actualización de datos inexactos o incompletos.</li>
          <li>Eliminación de tus datos.</li>
          <li>Oposición al tratamiento.</li>
          <li>Portabilidad: recibir tus datos en un formato estructurado y de uso común.</li>
          <li>Suspensión del tratamiento.</li>
          <li>No ser objeto de decisiones basadas únicamente en tratamientos automatizados.</li>
          <li>Retirar tu consentimiento, sin que eso afecte lo hecho antes de retirarlo.</li>
        </ul>
        <p>
          Puedes actualizar tu nombre y tu celular desde tu perfil. Para todo lo demás, escríbenos desde el correo o
          el celular de tu cuenta a los datos de contacto de la sección 1. Para proteger tu cuenta, podemos pedirte
          que confirmes tu identidad. Responderemos en un plazo máximo de 15 días.
        </p>
        <p>
          Si consideras que no atendimos tu solicitud, puedes presentar un reclamo ante la Superintendencia de
          Protección de Datos Personales del Ecuador.
        </p>
      </>
    ),
  },
  {
    id: "eliminacion",
    title: "Cómo eliminar tus datos",
    body: (
      <>
        <p>Para eliminar tu cuenta y tus datos personales:</p>
        <ul>
          <li>
            Escribe a <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> o por{" "}
            <a href={LEGAL.whatsappUrl} target="_blank" rel="noopener noreferrer">
              WhatsApp al {LEGAL.whatsappLabel}
            </a>{" "}
            con el asunto “Eliminar mi cuenta”, desde el correo o el celular registrados.
          </li>
          <li>Confirmaremos tu identidad y eliminaremos tu cuenta en un plazo máximo de 15 días.</li>
          <li>
            Solo conservaremos, bloqueados y sin otro uso, los registros de pedidos que la ley nos obligue a guardar,
            durante el plazo legal.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "seguridad",
    title: "Seguridad",
    body: (
      <p>
        Usamos conexión cifrada (HTTPS), contraseñas y códigos de verificación guardados de forma que no se puedan
        leer, límites de intentos para evitar accesos indebidos y acceso a los datos restringido a quien lo necesita
        para su función. Ningún sistema es infalible: si ocurriera una vulneración que afecte tus datos, te
        informaremos y lo notificaremos a la autoridad según la ley.
      </p>
    ),
  },
  {
    id: "cookies",
    title: "Cookies y almacenamiento del navegador",
    body: (
      <p>
        Usamos solo una cookie de sesión, necesaria para mantenerte conectado, y guardamos tu carrito en el
        almacenamiento de tu propio navegador. No usamos cookies de publicidad ni de seguimiento de terceros.
      </p>
    ),
  },
  {
    id: "menores",
    title: "Menores de edad",
    body: (
      <p>
        Dfly está dirigido a mayores de 18 años. No creamos cuentas a sabiendas para menores de edad; si detectamos
        una, la eliminaremos.
      </p>
    ),
  },
  {
    id: "cambios",
    title: "Cambios en esta política",
    body: (
      <p>
        Si cambiamos esta política, publicaremos la nueva versión aquí con su fecha. Si el cambio es importante, te lo
        avisaremos por correo o al iniciar sesión.
      </p>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de privacidad"
      intro={
        <p>
          En {LEGAL.brand} cuidamos tus datos personales. Aquí te explicamos qué datos recogemos, para qué los usamos,
          con quién los compartimos y cómo puedes ejercer tus derechos, conforme a la Ley Orgánica de Protección de
          Datos Personales del Ecuador.
        </p>
      }
      sections={sections}
    />
  );
}
