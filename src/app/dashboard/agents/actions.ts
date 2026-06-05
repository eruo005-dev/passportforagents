"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { claimAgent, getOwnedAgent, registerSubAgent } from "@/lib/agents";
import {
  pendingChallengeToken,
  runSecretHygieneScan,
  verifyDns,
  verifyWellKnown,
} from "@/lib/verification/service";
import { refreshRegistryPresence } from "@/lib/registry/ingest";
import { linkVerifiedDomain } from "@/lib/domains";

export type ActionState = { error?: string; ok?: string } | null;

export async function claimAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = String(formData.get("name") ?? "");
  const domain = String(formData.get("domain") ?? "");
  const description = String(formData.get("description") ?? "");
  let agentId: string;
  try {
    const agent = await claimAgent({ name, domain, description });
    agentId = agent.id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/agents/${agentId}`);
}

export async function registerSubAgentAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const domainId = String(formData.get("domainId") ?? "");
  const name = String(formData.get("name") ?? "");
  const capabilities = String(formData.get("capabilities") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  let agentId: string;
  try {
    const agent = await registerSubAgent({ domainId, name, capabilities });
    agentId = agent.id;
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/dashboard");
  redirect(`/dashboard/agents/${agentId}`);
}

export async function verifyWellKnownAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("agentId") ?? "");
  const agent = await getOwnedAgent(id); // server-side ownership check
  if (!agent) return { error: "Agent not found" };

  const result = await verifyWellKnown(agent.id, agent.domain);
  if (result.valid) {
    await runSecretHygieneScan(agent.id); // scan own claimed domain
    await refreshRegistryPresence(agent.id); // MCP-registry presence signal
    await linkVerifiedDomain(agent.id); // promote to a first-class verified domain
  }
  revalidatePath(`/dashboard/agents/${id}`);
  revalidatePath(`/agent/${agent.slug}`);
  return result.valid
    ? { ok: "Verified — your agent is now key-verified." }
    : { error: result.error ?? "Verification failed." };
}

export async function verifyDnsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const id = String(formData.get("agentId") ?? "");
  const agent = await getOwnedAgent(id);
  if (!agent) return { error: "Agent not found" };

  const token = await pendingChallengeToken(agent.id);
  if (!token) return { error: "No challenge token found for this agent." };

  const result = await verifyDns(agent.id, agent.domain, token);
  if (result.matched) {
    await runSecretHygieneScan(agent.id); // scan own claimed domain
    await linkVerifiedDomain(agent.id); // promote to a first-class verified domain
  }
  revalidatePath(`/dashboard/agents/${id}`);
  revalidatePath(`/agent/${agent.slug}`);
  return result.matched
    ? { ok: "DNS TXT record matched — domain verified." }
    : { error: result.error ?? "Challenge record not found on the domain." };
}
