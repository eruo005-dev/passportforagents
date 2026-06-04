"use server";

import { revalidatePath } from "next/cache";
import { ensureOwner } from "@/lib/owners";
import { submitReview } from "@/lib/reviews/service";

export type ReviewState = { error?: string; ok?: string } | null;

export async function submitReviewAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const owner = await ensureOwner();
  if (!owner) return { error: "Sign in to review" };
  const agentId = String(formData.get("agentId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const rating = Number(formData.get("rating") ?? "0");
  const comment = String(formData.get("comment") ?? "");
  try {
    await submitReview(owner.id, agentId, rating, comment);
  } catch (e) {
    return { error: (e as Error).message };
  }
  if (slug) revalidatePath(`/agent/${slug}`);
  return { ok: "Thanks — your review was recorded." };
}
