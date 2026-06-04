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

## Next: Sprint 2 — Verification + profiles (not started)

GitHub / `.well-known` / DNS-TXT verification flows; claim an MCP server; public
profile at `/agent/[slug]`.

**New keys needed at Sprint 2:** `GITHUB_TOKEN` (repo verification),
`RESEND_API_KEY` (verification emails).
