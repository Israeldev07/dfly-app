"use server";

import { auth } from "@/auth";
import { profileSchema } from "@/lib/validations/auth";
import { updateUserName } from "./accounts";
import { fieldErrorsFrom, SESSION_EXPIRED } from "./form-errors";

export type ProfileState = { ok?: boolean; fieldErrors?: Partial<Record<string, string>>; values?: Record<string, string> };

export async function updateProfileAction(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const session = await auth();
  if (!session?.user?.id) return { fieldErrors: { name: SESSION_EXPIRED } };

  const raw = { name: String(formData.get("name") ?? "") };
  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { fieldErrors: fieldErrorsFrom(parsed.error.issues), values: raw };

  await updateUserName(session.user.id, parsed.data.name);
  return { ok: true, values: raw };
}
