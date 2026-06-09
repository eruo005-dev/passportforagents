"use server";

import { revalidatePath } from "next/cache";
import { ensureOwner } from "@/lib/owners";
import { createApiKey, revokeApiKey } from "@/lib/api-keys/service";

export type KeyActionState =
  | { plaintext?: string; prefix?: string; error?: string }
  | null;

export async function createKeyAction(
  _prev: KeyActionState,
  formData: FormData,
): Promise<KeyActionState> {
  const owner = await ensureOwner();
  if (!owner) return { error: "Not signed in" };
  const label = String(formData.get("label") ?? "");
  const { plaintext, record } = await createApiKey(owner.id, label);
  revalidatePath("/dashboard/api-keys");
  // Return the plaintext ONCE — it is never recoverable after this.
  return { plaintext, prefix: record.keyPrefix };
}

export async function revokeKeyAction(
  _prev: KeyActionState,
  formData: FormData,
): Promise<KeyActionState> {
  const owner = await ensureOwner();
  if (!owner) return { error: "Not signed in" };
  const keyId = String(formData.get("keyId") ?? "");
  await revokeApiKey(owner.id, keyId); // scoped to owner server-side
  revalidatePath("/dashboard/api-keys");
  return null;
}
