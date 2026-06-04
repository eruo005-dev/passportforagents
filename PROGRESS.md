# AgentPassport — Build Progress

Working product name: **AgentPassport** (PassportForAgents.com).
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
- **Auth:** Clerk (app "AgentPassport", GitHub + Email). `src/proxy.ts`
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

## Roadmap (post-research-001)

- **Sprint 3 (in progress) — RESEQUENCED + AUGMENTED.** Lead with **badge +
  Verify API + secret-hygiene**; trust score (module 1, shipped) rides along as
  enrichment. **Added:** free public trust-report SEO/GEO pages (S-sized,
  acquisition). DNS-rebind TOCTOU fix lands here (pre-public Verify API).
- **Sprint 4 (elevated) — A2A-native JWS+JCS sign/verify** (the differentiation
  moat; A2A proposal #1672 is open) + lightweight re-verify freshness webhooks +
  **pricing/billing** (informed by design-partner price tests).
- **Sprint 5 — ingest + enrich the official MCP Registry** (it explicitly
  delegates trust downstream → that's us; supply + SEO engine).
- **Sprint 6 — "verify before connect" MCP client/gateway SDK** (verifier-side
  revenue compounds).
- **Backlog:** sigstore/SLSA provenance enrichment.

### ESCALATE TO HUMAN
1. **Pricing approval** — research recommends (all $ are TEST-with-design-partners,
   charge-the-verifier is firm): Free = unlimited claims + 1,000 verify calls/mo;
   Pro **$29/mo**; Team/Business **$99/$199/mo**; metered **$0.005/call**. The meter
   is built in S3; the **human approves the final numbers** (ideally after 3–5
   design-partner calls). Full table + sources in `RESEARCH.md` pass 001.
2. **Design-partner outreach** — needs human greenlight to reach out (founder
   relationships) to validate the verify-call price.
3. **A2A signing posture (S4)** — confirm we want to publicly align with / build
   on A2A proposal #1672 before making it a headline feature (public positioning).
4. **Secret-hygiene scan** — ✅ DECIDED (light active probing; claimed-domains-only,
   fixed allowlist, gentle, SSRF-safe, disclosed). **DNS-rebind** — tracked
   technical fix in S3 (executor owns).
