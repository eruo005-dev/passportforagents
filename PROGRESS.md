# PassportForAgents — Build Progress

Working product name: **PassportForAgents** (PassportForAgents.com).
Beachhead: verification + trust scoring for **MCP servers**.

---

## Sprint 1 — Foundation ✅ (awaiting checkpoint review)

**Goal:** repo scaffold, DB + schema live, auth, dashboard shell, open spec +
standalone reference verifier.

### Done

- **Scaffold:** Next.js 16.2.7 (App Router, TypeScript, Turbopack) + Tailwind v4
  + shadcn/ui primitives (`Button`, `cn`, design tokens, dark default).
- **Database:** Supabase project `agentpassport-db` (dedicated, US-East, Free),
  wired via Drizzle ORM (`postgres.js`). Pooler (`:6543`, `prepare:false`) for
  runtime, direct (`:5432`) for migrations.
- **Schema (Section 2 spine):** 9 tables migrated and verified live —
  `owners, agents, verifications, credentials, trust_signals, reviews,
  api_keys, verification_calls, registry_ingest`. Identity / registry /
  reputation kept cleanly separated so the identity primitive can be swapped
  later. Migration SQL checked in at `drizzle/0000_*.sql`.
- **Auth:** Clerk (app "PassportForAgents", GitHub + Email). `src/proxy.ts`
  (Next 16's renamed middleware) gates `/dashboard`. `ensureOwner()` upserts an
  `owners` row on first dashboard visit.
- **Pages:** landing (`/`), `/sign-in`, `/sign-up`, protected `/dashboard`
  shell, `/spec`.
- **Open spec:** `SPEC.md` (MIT) — the `.well-known/agent-passport.json` schema,
  multibase Multikey key encoding, RFC 8785 JCS canonicalization, Ed25519
  detached signature, domain-match rule.
- **Reference verifier:** `spec/verify.mts` — standalone, zero dependence on the
  hosted service. `spec/generate-fixture.mts` produces signed + tampered
  fixtures. Verified: valid → PASS, tampered → signature FAIL, wrong host →
  domain-mismatch FAIL.
- **Crypto lib:** `src/lib/crypto/{ed25519,jcs,multibase}.ts` +
  `src/lib/passport/{types,core}.ts` (single source of truth, shared by app and
  CLI). RFC 8785 JCS implemented inline (no heavyweight dep).
- **Build:** `next build` passes clean (TypeScript OK, no warnings). Dev server
  smoke-tested: `/` & `/spec` → 200, `/dashboard` → 307 → Clerk sign-in.

### Decisions

- Dedicated Supabase project (not shared with other projects) for clean
  isolation and acquirability.
- DB connection split: pooler for runtime, direct for migrations.
- Public key as base58btc multibase Multikey (`did:key`-compatible), so the
  identity type is self-describing and swappable.
- Dropped the `canonicalize` npm package (ESM-only → tsx friction); JCS is a
  ~20-line inline implementation, correct for the string-only documents we sign.

### How to test this checkpoint

```bash
npm install
# 1. Reference verifier (no DB / no auth needed):
npm run fixture
npm run verify -- --file spec/fixtures/agent-passport.json --host example.com   # ✓ VALID
npm run verify -- --file spec/fixtures/agent-passport.tampered.json --host example.com  # ✗ INVALID

# 2. App + auth + schema:
npm run dev            # open http://localhost:3000
#   → sign in (GitHub or email), land on /dashboard, an owners row is created.
npm run db:studio      # inspect the live schema / owners row
```

---

## Operating model change (2026-06-04)

Switched to a self-driving founding team (see `WORKING_AGREEMENT.md`):
**CEO agent** scopes → **executor** (main session) builds + self-verifies →
**Reviewer agent** adversarially gates → CEO signs off → next sprint. Full-auto
per sprint; only the human-guardrail actions (money/publish/keys/delete/legal/
fundraise) stop for the human.

---

## Sprint 2 — Claim, Verify, Public Profile ✅ (CEO: APPROVED)

**Goal met:** an owner claims an MCP server, proves domain control via
`.well-known` (signature → `key_verified`) or DNS TXT (→ `domain_verified`), and
the world sees a public profile at `/agent/[slug]`. Zero new keys required.

### Done
- **Claim flow** (`/dashboard/agents/new`) → `agents` row + unique slug
  (collision retry on PG 23505) + pending DNS challenge token.
- **`.well-known` + Ed25519 verification** (primary) → `key_verified`, mirrors
  `public_key`/`capabilities`/`verifiedDomain`, writes `verifications.evidence`
  + `domain_control`/`signed_provenance` trust signals. **SSRF-hardened fetch**:
  blocks private/loopback/link-local/CGNAT/IPv6/mapped ranges, HTTPS-only,
  refuses redirects, 5s timeout, 64KB cap enforced on **streamed bytes**.
- **DNS TXT verification** (secondary) → `domain_verified`; never downgrades a
  `key_verified` agent; never itself reaches `key_verified`.
- **Public profile** `/agent/[slug]` (SSR, anonymous, 404 on unknown) + dashboard
  agent list with status pills. Server-side ownership on every mutating action.
- **Tests:** 9 unit (valid/tampered/wrong-host, dns match/missing/exact,
  safe-fetch cap) + 3 DB integration (key_verified persistence,
  token-poisoning regression, tampered-stays-unverified). build + lint clean.

### Review loop
First Reviewer pass **FAILed** — caught a real **HIGH** (a `.well-known` verify
poisoned the DNS challenge-token lookup → broke the DNS path) and a **MEDIUM**
(header-only size cap bypassable via chunked encoding). Both fixed + a LOW slug
race; re-review **PASS**, findings independently verified.

### Known limitation (tracked)
- **DNS-rebind TOCTOU** in `safeFetch`: we vet the resolved IP then fetch by
  hostname. Accepted for v1; to be hardened (pin the vetted IP) before the public
  Verify API is exposed at scale.

---

## Positioning (locked 2026-06-04, research pass 001)

**Verifiable agent IDENTITY — "SPF/DKIM for AI agents."** Open, self-checkable
spec (domain control + Ed25519), charge the verifier. The 0–100 trust score is a
**secondary enrichment signal**, not the pitch — the generic-score lane is
already contested (mcp-trust.com, AgentAudit, et al.). The moat is the signed
identity primitive + A2A-native verify + the embeddable live badge. See
`RESEARCH.md` pass 001.

## Sprint 3 — Revenue layer ✅ (CEO: APPROVED 2026-06-04)

All 6 locked criteria PASS (Reviewer-verified). **31 tests** (23 unit + 8 DB
integration), build + lint clean.
- Transparent trust score + per-signal breakdown on the public profile;
  doc↔code drift test. Score is enrichment, not the pitch.
- Embeddable live SVG badge `/agent/[slug]/badge` (cacheable, anonymous,
  unspoofable, links back).
- Secret-hygiene scan: light active probing of a FIXED allowlist on the agent's
  OWN claimed domain (record-derived), sequential/gentle via SSRF-safe fetch,
  stores path+redacted reason never the value, disclosed at claim.
- Public **Verify API** `/api/v1/verify`: hash-auth, identity+status+score, no
  owner data leaked, every call logged to `verification_calls`, free-quota 429.
  Dashboard API-key create/revoke + usage meter. (Meter only — NO Stripe yet.)
- **DNS-rebind TOCTOU closed**: safeFetch pins the vetted IP (TLS validates
  hostname); zero new deps.
- **S3.5 micro-task done:** JSON-LD structured data on the profile (SEO/AEO);
  `docs/verify-api.md` documents the `verified`-semantics note.

Reviewer LOW advisories: (1) quota meter TOCTOU → **S4 (fix atomically with
billing)**; (2) unverified agent resolvable by domain (status truthful) →
documented in `docs/verify-api.md`, backlog.

## Roadmap (post-research-001)
- **Sprint 4 — billing FIRST, then A2A.** (a) Pricing/billing (Stripe) + the
  **atomic quota-meter fix** (clears advisory #1) in the same work; (b)
  A2A-native JWS+JCS sign/verify (the differentiation moat; proposal #1672 open);
  (c) lightweight re-verify freshness webhooks.
- **Sprint 5 — ingest + enrich the official MCP Registry** (it delegates trust
  downstream → that's us; supply + SEO engine). **+ `/registry` index page &
  sitemap** (the rest of SEO opportunity #7, now that there's inventory).
- **Sprint 6 — "verify before connect" MCP client/gateway SDK** (verifier-side
  revenue compounds).
- **Backlog:** sigstore/SLSA provenance enrichment; quota TOCTOU note (folded
  into S4 billing).

### ESCALATE TO HUMAN — S4
- **Live Stripe keys + account/ToS/tax setup** — human provisions the Stripe
  account, sets products/prices, supplies keys via env/secret store (never repo).
  Blocks the billing half of S4.
- **Public Verify-API announcement** — going public is a one-way trust
  commitment (SLA/abuse surface). Code ships behind keys without it; explicit
  human GO required before any public launch/marketing of the endpoint.

### ESCALATE TO HUMAN — ✅ ALL GREENLIT (2026-06-04)
1. **Pricing** — ✅ APPROVED as the model to build toward: Free = unlimited claims
   + 1,000 verify calls/mo; Pro **$29/mo**; Team/Business **$99/$199/mo**; metered
   **$0.005/call**. Numbers to be validated with design partners before we actually
   charge; charge-the-verifier model firm. (Wiring live Stripe/charging customers
   is still a human-authorized action at S4 billing.)
2. **Design-partner outreach** — ✅ APPROVED. Executor drafts the target list +
   outreach copy; the **human sends** the messages (no auto-send on their behalf).
3. **A2A posture (S4)** — ✅ APPROVED to build on / align with proposal #1672 as a
   headline feature. Internal build proceeds; any *public* spec contribution/post
   still surfaces to the human (publish guardrail).
4. **Secret-hygiene scan** — ✅ DECIDED (light active probing; claimed-domains-only,
   fixed allowlist, gentle, SSRF-safe, disclosed). **DNS-rebind** — tracked
   technical fix in S3 (executor owns).
