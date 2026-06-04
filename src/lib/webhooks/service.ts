import "server-only";
import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { agents, verifications, webhookEndpoints } from "@/db/schema";
import { safeFetch } from "@/lib/verification/safe-fetch";
import { evaluateFreshness } from "./freshness";
import { SIGNATURE_HEADER, generateWebhookSecret, signPayload } from "./sign";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── endpoint management ─────────────────────────────────────────────────────

export async function registerWebhook(ownerId: string, url: string) {
  const u = url.trim();
  if (!/^https:\/\/.+/i.test(u)) throw new Error("Webhook URL must be HTTPS");
  const secret = generateWebhookSecret();
  const [endpoint] = await db
    .insert(webhookEndpoints)
    .values({ ownerId, url: u, secret })
    .returning();
  return { endpoint, secret }; // secret shown once for the receiver to verify with
}

export async function listWebhooks(ownerId: string) {
  return db.query.webhookEndpoints.findMany({
    where: eq(webhookEndpoints.ownerId, ownerId),
    orderBy: [desc(webhookEndpoints.createdAt)],
  });
}

export async function setWebhookActive(ownerId: string, id: string, active: boolean) {
  await db
    .update(webhookEndpoints)
    .set({ active })
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.ownerId, ownerId)));
}

// ── delivery (SSRF-safe POST + HMAC + bounded retry) ────────────────────────

export type WebhookEvent = Record<string, unknown> & { type: string };

export async function deliverWebhook(
  endpoint: { id: string; url: string; secret: string },
  event: WebhookEvent,
  opts: { fetchImpl?: Fetcher; now?: Date; attempts?: number; delayMs?: number } = {},
): Promise<boolean> {
  const fetchImpl = opts.fetchImpl ?? safeFetch;
  const now = opts.now ?? new Date();
  const maxAttempts = opts.attempts ?? 3;
  const delayMs = opts.delayMs ?? 500;

  const payload = JSON.stringify(event);
  const ts = Math.floor(now.getTime() / 1000);
  const signature = signPayload(endpoint.secret, payload, ts);

  let lastStatus = "failed";
  let ok = false;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetchImpl(endpoint.url, {
        method: "POST",
        headers: { "content-type": "application/json", [SIGNATURE_HEADER]: signature },
        body: payload,
      });
      if (res.ok) {
        ok = true;
        lastStatus = `delivered:${res.status}`;
        break;
      }
      lastStatus = `http_${res.status}`;
    } catch (e) {
      lastStatus = `error:${(e as Error).message}`.slice(0, 120);
    }
    if (attempt < maxAttempts && delayMs > 0) await sleep(delayMs * attempt); // backoff
  }

  await db
    .update(webhookEndpoints)
    .set({ lastDeliveryAt: now, lastStatus })
    .where(eq(webhookEndpoints.id, endpoint.id));
  return ok;
}

// ── freshness sweep (cron) ──────────────────────────────────────────────────

/**
 * Evaluate every verified agent's freshness; when an agent's label CHANGES
 * (fresh↔stale) vs its stored state, update it and fire webhooks to the owner's
 * active endpoints. Idempotent: re-running without a change delivers nothing.
 */
export async function runFreshnessSweep(
  opts: { now?: Date; fetchImpl?: Fetcher; delayMs?: number } = {},
) {
  const now = opts.now ?? new Date();
  const verified = await db.query.agents.findMany({
    where: inArray(agents.status, ["key_verified", "domain_verified"]),
  });

  let changed = 0;
  let delivered = 0;

  for (const agent of verified) {
    const latest = await db.query.verifications.findFirst({
      where: and(eq(verifications.agentId, agent.id), isNotNull(verifications.verifiedAt)),
      orderBy: [desc(verifications.verifiedAt)],
    });
    const { current, changed: shouldFire } = evaluateFreshness(
      agent.freshnessState,
      latest?.expiresAt ?? null,
      now,
    );
    // Keep stored state accurate even when we don't fire (e.g. initial "fresh").
    if (current !== agent.freshnessState) {
      await db.update(agents).set({ freshnessState: current }).where(eq(agents.id, agent.id));
    }
    if (!shouldFire) continue;
    changed++;

    const endpoints = await db.query.webhookEndpoints.findMany({
      where: and(eq(webhookEndpoints.ownerId, agent.ownerId), eq(webhookEndpoints.active, true)),
    });
    const event: WebhookEvent = {
      type: "agent.freshness_changed",
      agent: { slug: agent.slug, name: agent.name, status: agent.status },
      state: current,
      expires_at: latest?.expiresAt?.toISOString() ?? null,
      occurred_at: now.toISOString(),
    };
    for (const ep of endpoints) {
      const sent = await deliverWebhook(ep, event, {
        fetchImpl: opts.fetchImpl,
        now,
        delayMs: opts.delayMs,
      });
      if (sent) delivered++;
    }
  }

  return { checked: verified.length, changed, delivered };
}
