import "dotenv/config";
import { TEMPLATE_DEFINITIONS, TEMPLATE_LANGUAGE, templateProblems, toGraphPayload } from "../src/modules/messaging/templates";

// Registra en Meta las plantillas de WhatsApp de Dfly (src/modules/messaging/templates.ts).
//   npm run wa:templates            → muestra el estado de cada plantilla en Meta (no cambia nada)
//   npm run wa:templates -- --create → crea las que faltan (las existentes no se tocan)
// Requiere WHATSAPP_TOKEN y WHATSAPP_BUSINESS_ACCOUNT_ID (el ID de la cuenta de WhatsApp Business,
// no el del número). El token necesita el permiso whatsapp_business_management.

const token = process.env.WHATSAPP_TOKEN;
const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
const version = process.env.WHATSAPP_API_VERSION || "v25.0";
const create = process.argv.includes("--create");

type GraphError = { error?: { message?: string; error_user_msg?: string } };
type Existing = { name: string; language: string; status: string; category: string; rejected_reason?: string };

async function graph<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`https://graph.facebook.com/${version}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = (await res.json().catch(() => ({}))) as T & GraphError;
  if (!res.ok) throw new Error(data.error?.error_user_msg || data.error?.message || `HTTP ${res.status}`);
  return data;
}

async function existingTemplates() {
  const all: Existing[] = [];
  let next: string | undefined = `${wabaId}/message_templates?fields=name,language,status,category,rejected_reason&limit=100`;
  while (next) {
    const page: { data: Existing[]; paging?: { next?: string } } = await graph(next);
    all.push(...page.data);
    next = page.paging?.next?.replace(/^https:\/\/graph\.facebook\.com\/v[\d.]+\//, "");
  }
  return all.filter((t) => t.language === TEMPLATE_LANGUAGE);
}

async function main() {
  const invalid = TEMPLATE_DEFINITIONS.flatMap((t) => templateProblems(t).map((p) => `${t.name}: ${p}`));
  if (invalid.length > 0) throw new Error(`Plantillas inválidas:\n  ${invalid.join("\n  ")}`);
  if (!token || !wabaId) throw new Error("Faltan WHATSAPP_TOKEN o WHATSAPP_BUSINESS_ACCOUNT_ID en .env");

  const existing = new Map((await existingTemplates()).map((t) => [t.name, t]));
  let missing = 0;
  for (const def of TEMPLATE_DEFINITIONS) {
    const found = existing.get(def.name);
    if (found) {
      const reason = found.rejected_reason && found.rejected_reason !== "NONE" ? ` (${found.rejected_reason})` : "";
      const category = found.category !== def.category ? ` ⚠ Meta la clasificó como ${found.category}` : "";
      console.log(`  ${found.status.padEnd(9)} ${def.name}${reason}${category}`);
      continue;
    }
    if (!create) {
      missing++;
      console.log(`  FALTA     ${def.name}`);
      continue;
    }
    try {
      const res = await graph<{ id: string; status: string }>(`${wabaId}/message_templates`, {
        method: "POST",
        body: JSON.stringify(toGraphPayload(def)),
      });
      console.log(`  CREADA    ${def.name} → ${res.status}`);
    } catch (e) {
      console.error(`  ERROR     ${def.name}: ${(e as Error).message}`);
      process.exitCode = 1;
    }
  }
  if (missing > 0) console.log(`\nFaltan ${missing}. Créalas con: npm run wa:templates -- --create`);
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exit(1);
});
