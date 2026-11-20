import { z } from "zod";

// trim antes de validar: el autocompletado del celular suele dejar un espacio al final.
export const emailSchema = z.string().trim().toLowerCase().pipe(z.email("Ingresa un email válido"));

/** bcrypt solo usa los primeros 72 bytes: con acentos o emojis, 72 caracteres pueden ser más. */
const passwordSchema = z
  .string()
  .min(8, "Mínimo 8 caracteres")
  .refine((v) => new TextEncoder().encode(v).length <= 72, "Máximo 72 caracteres (menos si usas acentos o emojis)");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Ingresa tu contraseña").max(200),
});

/** Quita el prefijo de país (+593) y el 0 inicial: "0991234567" y "+593991234567" → "991234567". */
export function stripEcuadorPrefix(phone: string) {
  return phone.replace(/^\+?593/, "").replace(/^0/, "");
}

/**
 * Celular de Ecuador: se acepta "0991234567", "991234567" o "+593991234567".
 * Se normaliza a E.164 (+5939XXXXXXXX), que es el formato que exige WhatsApp.
 */
export const ecuadorMobileSchema = z
  .string()
  .trim()
  .transform((v) => stripEcuadorPrefix(v.replace(/[\s()-]/g, "")))
  .pipe(z.string().regex(/^9\d{8}$/, "Ingresa un celular válido (ej. 099 123 4567)"))
  .transform((v) => `+593${v}`);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z.string().trim().min(2, "Ingresa tu nombre").max(80),
  phone: ecuadorMobileSchema,
  whatsappOptIn: z.literal("on", { error: "Necesitamos tu permiso para avisarte por WhatsApp" }),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z
  .object({ token: z.string().min(1), password: passwordSchema, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Las contraseñas no coinciden" });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;

/** El celular no se edita aquí: solo cambia verificándolo (`phoneSchema`). */
export const profileSchema = z.object({
  name: z.string().trim().min(2, "Ingresa tu nombre").max(80),
});

export const phoneSchema = z.object({ phone: ecuadorMobileSchema });
