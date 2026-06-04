import "server-only";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { agents, trustSignals } from "@/db/schema";
import { upsertTrustSignal } from "@/lib/verification/service";
import { safeFetch } from "@/lib/verification/safe-fetch";
import { pushSample, uptimeValue, type UptimeSample } from "./window";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/**
 * Health-probe every verified agent's domain and update its `uptime` trust
 * signal (rolling window). Probes go through the SSRF-hardened safeFetch
 * (HTTPS-only, IP-pinned, no redirects, bounded). `fetchImpl`/`now` injectable.
 */
export async function runUptimeSweep(opts: {
  fetchImpl?: Fetcher;
  now?: Date;
  maxAgents?: number;
} = {}) {
  const fetchImpl = opts.fetchImpl ?? safeFetch;
  const at = (opts.now ?? new Date()).toISOString();
  const maxAgents = opts.maxAgents ?? 500;

  const verified = await db.query.agents.findMany({
    where: inArray(agents.status, ["key_verified", "domain_verified"]),
    limit: maxAgents,
  });

  let up = 0;
  let down = 0;
  for (const agent of verified) {
    const domain = agent.verifiedDomain ?? agent.domain;
    let ok = false;
    try {
      const res = await fetchImpl(`https://${domain}/.well-known/agent-passport.json`);
      ok = res.ok;
    } catch {
      ok = false;
    }
    ok ? up++ : down++;

    const existing = await db.query.trustSignals.findFirst({
      where: and(eq(trustSignals.agentId, agent.id), eq(trustSignals.signalType, "uptime")),
    });
    const prev = ((existing?.raw as { samples?: UptimeSample[] } | null)?.samples ?? []) as UptimeSample[];
    const samples = pushSample(prev, ok, at);
    await upsertTrustSignal(agent.id, "uptime", uptimeValue(samples), { samples });
  }

  return { checked: verified.length, up, down };
}
