"use server";

import { revalidatePath } from "next/cache";
import { ensureOwner } from "@/lib/owners";
import { registerWebhook, setWebhookActive } from "@/lib/webhooks/service";

export type WebhookActionState =
  | { secret?: string; url?: string; error?: string }
  | null;

export async function createWebhookAction(
  _prev: WebhookActionState,
  formData: FormData,
): Promise<WebhookActionState> {
  const owner = await ensureOwner();
  if (!owner) return { error: "Not signed in" };
  try {
    const { endpoint, secret } = await registerWebhook(
      owner.id,
      String(formData.get("url") ?? ""),
    );
    revalidatePath("/dashboard/webhooks");
    return { secret, url: endpoint.url }; // secret shown once
  } catch (e) {
    return { error: (e as Error).message };
  }
}

export async function toggleWebhookAction(
  _prev: WebhookActionState,
  formData: FormData,
): Promise<WebhookActionState> {
  const owner = await ensureOwner();
  if (!owner) return { error: "Not signed in" };
  const id = String(formData.get("id") ?? "");
  const active = String(formData.get("active") ?? "") === "true";
  await setWebhookActive(owner.id, id, active);
  revalidatePath("/dashboard/webhooks");
  return null;
}
