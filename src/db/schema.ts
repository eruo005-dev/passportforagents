/**
 * PassportForAgents database schema (Drizzle / PostgreSQL).
 *
 * Design principle: keep IDENTITY (agents.public_key, verifications,
 * credentials), the REGISTRY ENTRY (agents, registry_ingest), and REPUTATION
 * (trust_signals, reviews) cleanly separated so the identity primitive
 * (today: domain control + Ed25519) can later be swapped (JWT → VC → on-chain)
 * without touching the registry or reputation layers.
 */
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

// ── Enums ───────────────────────────────────────────────────────────────────

export const planTierEnum = pgEnum("plan_tier", ["free", "pro"]);
export const agentTypeEnum = pgEnum("agent_type", ["mcp_server", "a2a_agent"]);
export const agentStatusEnum = pgEnum("agent_status", [
  "unverified",
  "domain_verified",
  "key_verified",
  "suspended",
]);
export const verificationMethodEnum = pgEnum("verification_method", [
  "dns_txt",
  "well_known",
  "github",
  "a2a_card",
]);
export const trustSignalTypeEnum = pgEnum("trust_signal_type", [
  "domain_control",
  "uptime",
  "secret_hygiene",
  "user_rating",
  "registry_presence",
  "signed_provenance",
]);
export const registrySourceEnum = pgEnum("registry_source", [
  "mcp_registry",
  "cloudflare_signed_agents",
]);

// ── owners ────────────────────────────────────────────────────────────────--

export const owners = pgTable("owners", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkUserId: text("clerk_user_id").notNull().unique(),
  email: text("email").notNull(),
  planTier: planTierEnum("plan_tier").notNull().default("free"),
  stripeCustomerId: text("stripe_customer_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── agents ───────────────────────────────────────────────────────────────---

export const agents = pgTable("agents", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id, { onDelete: "cascade" }),
  type: agentTypeEnum("type").notNull().default("mcp_server"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  /** The domain the owner claims to control (set at claim time). */
  domain: text("domain").notNull(),
  homepageUrl: text("homepage_url"),
  repoUrl: text("repo_url"),
  /** Set once domain control is proven; may differ from `domain` in edge cases. */
  verifiedDomain: text("verified_domain"),
  /** Ed25519 public key as multibase Multikey. The identity primitive seam. */
  publicKey: text("public_key"),
  /** Declared capabilities mirrored from the passport document. */
  capabilities: jsonb("capabilities").$type<string[]>(),
  status: agentStatusEnum("status").notNull().default("unverified"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
});

// ── verifications ─────────────────────────────────────────────────────────--
// Re-checkable, expirable evidence that a verification method succeeded.

export const verifications = pgTable("verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  method: verificationMethodEnum("method").notNull(),
  challengeToken: text("challenge_token"),
  /** What we checked + the raw result (URL fetched, TXT records, repo path…). */
  evidence: jsonb("evidence"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── credentials ───────────────────────────────────────────────────────────--
// Generic signed-claim table. v1 only stores self-issued claims, but this is
// the seam where W3C Verifiable Credentials could plug in later.

export const credentials = pgTable("credentials", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  /** "owner" for self-issued, or a third-party issuer identifier. */
  issuer: text("issuer").notNull(),
  claim: jsonb("claim").notNull(),
  signature: text("signature"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// ── trust_signals ───────────────────────────────────────────────────────────
// The trust score is a TRANSPARENT weighted sum of these rows. Never a black
// box, never self-reported vanity metrics. See SPEC.md / trust formula docs.

export const trustSignals = pgTable("trust_signals", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id")
    .notNull()
    .references(() => agents.id, { onDelete: "cascade" }),
  signalType: trustSignalTypeEnum("signal_type").notNull(),
  /** Normalized signal value, 0..1. */
  value: real("value").notNull(),
  /** Weight applied in the score formula, 0..1. */
  weight: real("weight").notNull(),
  raw: jsonb("raw"),
  computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── reviews ─────────────────────────────────────────────────────────────────
// Sybil-resistant: only verified owners can review; one review per owner per
// agent (enforced by the unique constraint); `flagged` for anomaly detection.

export const reviews = pgTable(
  "reviews",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    agentId: uuid("agent_id")
      .notNull()
      .references(() => agents.id, { onDelete: "cascade" }),
    reviewerOwnerId: uuid("reviewer_owner_id")
      .notNull()
      .references(() => owners.id, { onDelete: "cascade" }),
    rating: integer("rating").notNull(), // 1..5 (enforced in app layer)
    comment: text("comment"),
    flagged: boolean("flagged").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_review_owner_agent").on(t.agentId, t.reviewerOwnerId)],
);

// ── api_keys ─────────────────────────────────────────────────────────────---

export const apiKeys = pgTable("api_keys", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => owners.id, { onDelete: "cascade" }),
  /** Only the hash of the key is stored; the plaintext is shown once at creation. */
  keyHash: text("key_hash").notNull().unique(),
  /** Non-secret display prefix, e.g. "ap_live_a1b2…". */
  keyPrefix: text("key_prefix").notNull(),
  /** Optional human label. */
  label: text("label"),
  scopes: jsonb("scopes").$type<string[]>().notNull().default([]),
  rateLimit: integer("rate_limit").notNull().default(1000),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  /** Soft-delete: revoked keys are rejected but preserved for call attribution. */
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
});

// ── verification_calls ────────────────────────────────────────────────────--
// The billable event: every third-party verify is logged here for metered
// billing + abuse throttling.

export const verificationCalls = pgTable("verification_calls", {
  id: uuid("id").primaryKey().defaultRandom(),
  agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
  /** The API key used to make the call (the party that gets billed). */
  apiKeyId: uuid("api_key_id").references(() => apiKeys.id, { onDelete: "set null" }),
  result: jsonb("result"),
  calledAt: timestamp("called_at", { withTimezone: true }).notNull().defaultNow(),
});

// ── registry_ingest ───────────────────────────────────────────────────────--
// Mirror of public registries, used to pre-populate listings and bootstrap a
// baseline trust dataset (registry_presence signal).

export const registryIngest = pgTable(
  "registry_ingest",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    source: registrySourceEnum("source").notNull(),
    externalId: text("external_id").notNull(),
    raw: jsonb("raw").notNull(),
    ingestedAt: timestamp("ingested_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("uq_ingest_source_external").on(t.source, t.externalId)],
);

// ── relations ─────────────────────────────────────────────────────────────--

export const ownersRelations = relations(owners, ({ many }) => ({
  agents: many(agents),
  reviews: many(reviews),
  apiKeys: many(apiKeys),
}));

export const agentsRelations = relations(agents, ({ one, many }) => ({
  owner: one(owners, { fields: [agents.ownerId], references: [owners.id] }),
  verifications: many(verifications),
  credentials: many(credentials),
  trustSignals: many(trustSignals),
  reviews: many(reviews),
}));

export const verificationsRelations = relations(verifications, ({ one }) => ({
  agent: one(agents, { fields: [verifications.agentId], references: [agents.id] }),
}));

export const credentialsRelations = relations(credentials, ({ one }) => ({
  agent: one(agents, { fields: [credentials.agentId], references: [agents.id] }),
}));

export const trustSignalsRelations = relations(trustSignals, ({ one }) => ({
  agent: one(agents, { fields: [trustSignals.agentId], references: [agents.id] }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  agent: one(agents, { fields: [reviews.agentId], references: [agents.id] }),
  reviewer: one(owners, {
    fields: [reviews.reviewerOwnerId],
    references: [owners.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one, many }) => ({
  owner: one(owners, { fields: [apiKeys.ownerId], references: [owners.id] }),
  calls: many(verificationCalls),
}));

export const verificationCallsRelations = relations(verificationCalls, ({ one }) => ({
  apiKey: one(apiKeys, {
    fields: [verificationCalls.apiKeyId],
    references: [apiKeys.id],
  }),
  agent: one(agents, { fields: [verificationCalls.agentId], references: [agents.id] }),
}));
