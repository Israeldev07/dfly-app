/**
 * Definición de las plantillas de WhatsApp tal como se registran en Meta (WhatsApp Manager o
 * `npm run wa:templates`). Cada `{{n}}` corresponde a `bodyParams[n - 1]` del builder en `messages.ts`;
 * `templates.test.ts` verifica que coincidan. Si cambias un texto aquí, también hay que cambiarlo
 * (y volver a aprobarlo) en Meta: el nombre y el idioma no se pueden editar.
 *
 * Reglas de Meta que respetan: el cuerpo no empieza ni termina con una variable, las variables van
 * en orden ({{1}}, {{2}}…) y el texto fijo de las de pedido no pasa de `TEMPLATE_FIXED_TEXT_MAX`.
 */
import { TEMPLATES, TEMPLATE_FIXED_TEXT_MAX } from "./messages";

type TemplateName = (typeof TEMPLATES)[keyof typeof TEMPLATES];

export type TemplateDefinition = {
  name: TemplateName;
  category: "UTILITY" | "AUTHENTICATION";
  /** Cuerpo con `{{n}}`. En las de autenticación lo escribe Meta y queda vacío. */
  body: string;
  /** Valores de ejemplo que pide Meta para revisar la plantilla, uno por variable. */
  example: string[];
  /** Textos de los botones quick reply, en el orden de `quickReplies`. */
  quickReplies?: string[];
  /** Solo autenticación: minutos de validez del código (pie de la plantilla). */
  codeExpirationMinutes?: number;
};

export const TEMPLATE_LANGUAGE = "es";

export const TEMPLATE_DEFINITIONS: TemplateDefinition[] = [
  {
    name: TEMPLATES.adminNewOrder,
    category: "UTILITY",
    body:
      "Llegó un nuevo pedido a Dfly con el código #{{1}}.\nComercio: {{2}}\nProductos: {{3}}\n" +
      "Total a cobrar: {{4}}, forma de pago: {{5}}\nCliente: {{6}}, teléfono {{7}}\n" +
      "Dirección de entrega: {{8}}\nIndicaciones: {{9}}\nRevisa el detalle en el panel de Dfly.",
    example: [
      "A7K2Q",
      "La Casa del Sabor",
      "2 x Hamburguesa clásica (papas fritas), 1 x Limonada",
      "$14.50",
      "Efectivo",
      "María Pérez",
      "+593991234567",
      "Calle Bolívar y Sucre, casa blanca",
      "Tocar el timbre",
    ],
  },
  {
    name: TEMPLATES.storeRequest,
    category: "UTILITY",
    body:
      "Nuevo pedido de Dfly #{{1}}\nProductos: {{2}}\nIndicaciones: {{3}}\n" +
      "Pulsa Aceptar si puedes prepararlo o Rechazar si no.",
    example: ["A7K2Q", "2 x Hamburguesa clásica (papas fritas), 1 x Limonada", "Sin cebolla"],
    quickReplies: ["Aceptar", "Rechazar"],
  },
  {
    name: TEMPLATES.orderDetailPart,
    category: "UTILITY",
    body: "Pedido #{{1}}, parte {{2}}:\n{{3}}\nContinuación del pedido de Dfly.",
    example: ["A7K2Q", "2/3", "1 x Papas fritas, 3 x Empanada de queso"],
  },
  {
    name: TEMPLATES.adminResult,
    category: "UTILITY",
    body: "Pedido #{{1}}: {{2}} lo marcó como {{3}}. Puedes verlo en el panel de Dfly.",
    example: ["A7K2Q", "La Casa del Sabor", "ACEPTADO"],
  },
  {
    name: TEMPLATES.customerAccepted,
    category: "UTILITY",
    body: "Hola {{1}}, tu pedido #{{2}} en {{3}} fue confirmado. ¡Ya lo están preparando!",
    example: ["María", "A7K2Q", "La Casa del Sabor"],
  },
  {
    name: TEMPLATES.customerRejected,
    category: "UTILITY",
    body: "Hola {{1}}, tu pedido #{{2}} en {{3}} no pudo ser tomado por el comercio. No se te cobrará nada.",
    example: ["María", "A7K2Q", "La Casa del Sabor"],
  },
  {
    name: TEMPLATES.adminExpired,
    category: "UTILITY",
    body: "Pedido #{{1}}: {{2}} no respondió en {{3}} minutos. Llama al comercio.",
    example: ["A7K2Q", "La Casa del Sabor", "5"],
  },
  {
    name: TEMPLATES.customerCancelled,
    category: "UTILITY",
    body: "Hola {{1}}, tu pedido #{{2}} en {{3}} fue cancelado. No se te cobrará nada.",
    example: ["María", "A7K2Q", "La Casa del Sabor"],
  },
  {
    name: TEMPLATES.storeCancelled,
    category: "UTILITY",
    body: "El pedido #{{1}} de Dfly para {{2}} fue CANCELADO. Por favor, no lo prepares.",
    example: ["A7K2Q", "La Casa del Sabor"],
  },
  {
    name: TEMPLATES.storeLate,
    category: "UTILITY",
    body:
      "El pedido #{{1}} de Dfly para {{2}} ya está {{3}}: NO lo prepares. Si pulsas Aceptar o Rechazar, " +
      "no se registrará. Dfly te contactará si hace falta.",
    example: ["A7K2Q", "La Casa del Sabor", "VENCIDO"],
  },
  {
    name: TEMPLATES.adminLate,
    category: "UTILITY",
    body: "Pedido #{{1}}: {{2}} pulsó {{3}} con el pedido ya {{4}}. Revisa si hace falta avisarle.",
    example: ["A7K2Q", "La Casa del Sabor", "ACEPTAR", "vencido"],
  },
  {
    name: TEMPLATES.adminCustomerCancelled,
    category: "UTILITY",
    body: "Pedido #{{1}} ({{2}}): el cliente lo canceló antes de que el comercio lo aceptara.",
    example: ["A7K2Q", "La Casa del Sabor"],
  },
  {
    name: TEMPLATES.adminCancelRequest,
    category: "UTILITY",
    body:
      "Hay una nueva solicitud de cancelación para el pedido #{{1}} del comercio {{2}}. " +
      "El cliente {{3}} pide cancelarlo por este motivo: {{4}}. Revísala y respóndele desde el panel de Dfly.",
    example: ["A7K2Q", "La Casa del Sabor", "María Pérez", "Me equivoqué de dirección"],
  },
  {
    name: TEMPLATES.customerCancelRejected,
    category: "UTILITY",
    body:
      "Hola {{1}}, no pudimos cancelar tu pedido #{{2}} en {{3}}: el comercio ya lo está preparando. " +
      "Escríbenos si tienes dudas.",
    example: ["María", "A7K2Q", "La Casa del Sabor"],
  },
  {
    // Meta arma el cuerpo: "{{1}} es tu código de verificación. Por tu seguridad, no lo compartas."
    name: TEMPLATES.authCode,
    category: "AUTHENTICATION",
    body: "",
    example: [],
    codeExpirationMinutes: 10,
  },
];

const VARIABLE = /\{\{(\d+)\}\}/g;

/** Números de las variables del cuerpo, en el orden en que aparecen. */
export function bodyVariables(body: string) {
  return [...body.matchAll(VARIABLE)].map((m) => Number(m[1]));
}

/** Texto fijo del cuerpo (sin variables), que cuenta para el límite de 1024 de Meta. */
export function fixedText(body: string) {
  return body.replace(VARIABLE, "");
}

/** Problemas que harían que Meta rechace la plantilla o que el envío falle. Vacío si está bien. */
export function templateProblems(t: TemplateDefinition): string[] {
  if (t.category === "AUTHENTICATION") return t.codeExpirationMinutes ? [] : ["falta codeExpirationMinutes"];
  const problems: string[] = [];
  const vars = bodyVariables(t.body);
  if (vars.some((n, i) => n !== i + 1)) problems.push("las variables deben ir en orden y sin saltos");
  if (vars.length !== t.example.length) problems.push(`tiene ${vars.length} variables y ${t.example.length} ejemplos`);
  if (/^\s*\{\{\d+\}\}/.test(t.body) || /\{\{\d+\}\}[\s.!?]*$/.test(t.body)) {
    problems.push("no puede empezar ni terminar con una variable");
  }
  if (fixedText(t.body).length > TEMPLATE_FIXED_TEXT_MAX) {
    problems.push(`el texto fijo pasa de ${TEMPLATE_FIXED_TEXT_MAX} caracteres`);
  }
  if ((t.quickReplies ?? []).some((b) => b.length > 25)) problems.push("un botón pasa de 25 caracteres");
  return problems;
}

/** Cuerpo de la petición a `POST /{WABA_ID}/message_templates`. */
export function toGraphPayload(t: TemplateDefinition) {
  if (t.category === "AUTHENTICATION") {
    return {
      name: t.name,
      language: TEMPLATE_LANGUAGE,
      category: t.category,
      components: [
        { type: "BODY", add_security_recommendation: true },
        { type: "FOOTER", code_expiration_minutes: t.codeExpirationMinutes },
        { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copiar código" }] },
      ],
    };
  }
  return {
    name: t.name,
    language: TEMPLATE_LANGUAGE,
    category: t.category,
    parameter_format: "POSITIONAL",
    components: [
      { type: "BODY", text: t.body, example: { body_text: [t.example] } },
      ...(t.quickReplies
        ? [{ type: "BUTTONS", buttons: t.quickReplies.map((text) => ({ type: "QUICK_REPLY", text })) }]
        : []),
    ],
  };
}
