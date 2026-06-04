# PassportForAgents — Research Ledger

Findings from the standing research track (see `WORKING_AGREEMENT.md`).
Produced by the `researcher` agent, vetted by the `reviewer`, triaged by the
`cofounder-ceo`, recorded by the executor. Pricing recommendations are
**proposals**; the actual price is a human-approved action.

> Format per pass: date · topics · vetted findings · CEO triage (adopt/backlog/
> reject) · what changed in the roadmap · open questions.

---

<!-- New research passes are appended below this line. -->

## Pass 002 — 2026-06-04 · A2A signed Agent Card mechanics (build-grounding)

Primary sources: A2A spec v1.0.0 (`a2aproject/A2A` `docs/specification.md`,
`specification/a2a.proto`), a2a-protocol.org, RFC 7515/8785/8615.

- **Card:** `GET /.well-known/agent-card.json` (legacy fallback `/.well-known/agent.json`);
  accept `application/json` + `application/a2a+json`; honor ETag/Cache-Control.
- **Signature (§8.4):** JWS (RFC 7515), **JSON serialization, detached payload**;
  lives in a `signatures[]` array of `{protected, signature, header?}`. Signing is
  **MAY**, not MUST.
- **alg:** spec exemplifies **ES256 / RS256**; does NOT close the set or mandate
  EdDSA. → accepted-alg allowlist is ours to choose (support ES256+RS256, plan EdDSA).
- **Signed input:** payload = **JCS (RFC 8785) of the card with `signatures` excluded**,
  applying protobuf field-presence (drop non-required default/empty like `extensions:[]`);
  JWS input = `BASE64URL(protected).BASE64URL(payload)`.
- **Key:** resolved via protected-header `kid` (+ optional `jku` JWKS URL over HTTPS).
  No mandated `jwk`/`x5c`/DID.
- **Identity binding is weak** — spec relies on TLS; binding key↦org is left to the
  verifier. **Our policy:** require `jku` host (or signing domain) to match the card's
  serving domain / `provider.url` host.
- **#1672 (`verifiedIdentity`):** OPEN issue, **maintainer-unendorsed, community-only**
  (proposes a 3rd-party CA `getagentid.dev`). Treat as ecosystem signal, NOT spec —
  **do not hardcode any single CA/registry**; keep identity-model pluggable.

**Build implications (applied):** JWS verify via Node stdlib `crypto` (ES256/RS256/EdDSA,
JWK import) → zero new deps; canonicalize card-as-received minus `signatures` via our
inline JCS; injectable key resolver (JWKS via safeFetch); our own domain-binding policy;
field-presence handling is the top false-negative risk → fixtures sign exactly what the
verifier reconstructs.

## Pass 001 — 2026-06-04 · Pricing/freemium · Competitive watch · Opportunities

**Reviewer verdict:** TRUSTWORTHY WITH CAVEATS — all high-stakes claims confirmed
real via fetched sources; fixes: Clerk Pro is **$25/mo** (not $20); MCP Registry
is still "preview" and also supports HTTP-challenge auth; metered verify price is
a defensible-but-untested analogy.

### Vetted findings
- **The generic "0–100 MCP trust score" space is CONTESTED** (confirmed):
  mcp-trust.com/BlueRock (~9k scored servers, free), AgentAudit (score + API +
  CLI), AgentScore, Trust3 (runtime), Stacklok ToolHive, AgentSeal, Docker MCP
  Catalog. A bare score is commoditized.
- **Ecosystem validates the thesis, leaves our wedge open:** A2A has JWS+JCS
  signed Agent Cards (v0.3, Jul 2025) + open proposal #1672 (`verifiedIdentity`);
  the official MCP Registry does namespace auth only and **explicitly delegates
  trust to "downstream aggregators"** (us); AWS AgentCore Identity + MS Entra
  Agent ID are enterprise intra-tenant IAM, not a public cross-org badge.
- **Pricing comparables:** Clerk (free→50K MAU, Pro $25), Snyk (free 200 OSS
  tests/mo, Team $25/dev), Socket (free OSS, Team $25, Business $50), Stripe
  Radar ($0.02–0.07/screened txn — the closest metered-trust analog).

### CEO triage — decisions
- **Positioning LOCKED:** "**verifiable agent IDENTITY — SPF/DKIM for AI agents**,"
  open self-checkable spec (domain control + Ed25519), charge the verifier.
  Demote the 0–100 score from headline to a secondary enrichment signal.
- **Pricing (RECOMMENDATION — human approves):** Free = unlimited claims +
  1,000 verify calls/mo; Pro **$29/mo** (~25K calls, private registry, analytics,
  re-verify alerts); Team/Business **$99/$199/mo** (SSO, seats, audit, SLA);
  metered **$0.005/call** ($5/1k). Charge-the-verifier model is FIRM; every $ and
  quota is **TEST-with-design-partners**.
- **Opportunities:** ADOPT → embeddable live-signed badge (S3, scoped), free
  public trust-report SEO pages (S3, new), A2A-native JWS+JCS verify (S4, elevated
  — the moat), MCP Registry ingest+enrich (S5), verify-before-connect SDK (S6).
  Freshness webhooks → fold into Pro (S4). Sigstore/SLSA provenance → BACKLOG.

### Executor final review + added notes
- **Accepted.** The reposition is the right read — leading with a commoditized
  score would have walked into a crowded lane. Our committed identity primitive
  (SPEC.md, Ed25519 + domain control) already IS the differentiator; the trust
  score stays (Sprint 3 module 1 shipped) but is framed as enrichment, not the
  pitch. Roadmap delta applied to PROGRESS.md.
- **Fix to apply:** none in code; the $20→$25 Clerk figure is corrected here.

### Open questions / suggested for next research pass
1. **Do any incumbents (mcp-trust.com, AgentAudit) already do signed
   *identity* (domain-control + keys) or only scanning/scoring?** If only
   scanning, our wedge is clean; if one ships signed identity, reassess. Also:
   ingest/partner vs compete with their catalogs.
2. **Design-partner targets** (MCP gateways, agent marketplaces, MCP client
   vendors) to validate the $0.005/verify price and willingness to pay.
3. **A2A #1672 trajectory** — does the spec name a trust authority/registry? If
   so, major threat-or-opportunity.
4. Competitor funding/traction (size the threat) — not found this pass.
