"use client";

import { useActionState } from "react";
import { submitReviewAction, type ReviewState } from "./review-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function ReviewForm({ agentId, slug }: { agentId: string; slug: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(
    submitReviewAction,
    null,
  );
  return (
    <form action={action} className="mt-4 flex flex-col gap-3">
      <input type="hidden" name="agentId" value={agentId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="flex items-center gap-2">
        <label htmlFor="rating" className="text-sm font-medium">
          Rating
        </label>
        <select
          id="rating"
          name="rating"
          defaultValue="5"
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
        >
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {n} ★
            </option>
          ))}
        </select>
      </div>
      <Input name="comment" placeholder="Optional comment" />
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-success">{state.ok}</p>}
      <Button type="submit" disabled={pending} size="sm" className="self-start">
        {pending ? "Submitting…" : "Submit review"}
      </Button>
    </form>
  );
}
