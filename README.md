# PassportForAgents

**The verified-agent badge, trust API, and public registry for the open MCP / A2A ecosystem.**
_Is this agent who it claims to be — and is it any good? Answered in one API call._

Identity is established the same way the web already does it: **control of a
domain + an Ed25519-signed JSON document**. No blockchain, no DID method, no
central authority required to verify. See [`SPEC.md`](./SPEC.md).

---

## Stack

| Layer     | Choice                                                      |
| --------- | ----------------------------------------------------------- |
| Framework | Next.js 16 (App Router, TypeScript, Turbopack)              |
| Database  | Supabase Postgres + Drizzle ORM (migrations in repo)        |
| Auth      | Clerk (GitHub + Email)                                      |
| Crypto    | `@noble/ed25519` + `@noble/hashes`, RFC 8785 JCS, multibase |
| UI        | Tailwind v4 + shadcn/ui (dark default)                      |

## Quick start

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Clerk keys
npm run db:migrate           # apply schema to your database
npm run dev                  # http://localhost:3000
```

## The open spec & reference verifier

The `.well-known/agent-passport.json` schema and a standalone verifier are
MIT-licensed and have **zero dependence on the hosted service**:

```bash
npm run fixture                                                   # generate a signed sample
npm run verify -- --file spec/fixtures/agent-passport.json --host example.com   # ✓ VALID
npm run verify -- example.com                                     # verify a live domain
```

## Scripts

| Script             | Purpose                                  |
| ------------------ | ---------------------------------------- |
| `npm run dev`      | Dev server                               |
| `npm run build`    | Production build                         |
| `npm run db:generate` | Generate migration SQL from schema    |
| `npm run db:migrate`  | Apply migrations (direct `:5432` conn) |
| `npm run db:studio`   | Drizzle Studio                         |
| `npm run verify`   | Run the reference verifier               |
| `npm run fixture`  | Generate signed/tampered test fixtures   |

## Layout

```
src/
  app/                 # routes: /, /sign-in, /sign-up, /dashboard, /spec
  components/ui/        # shadcn primitives
  db/                   # Drizzle schema + client
  lib/
    crypto/             # ed25519, JCS, multibase
    passport/           # passport types + shared sign/verify core
  proxy.ts              # Clerk auth gate (Next 16's renamed middleware)
spec/
  verify.mts            # standalone reference verifier (MIT)
  generate-fixture.mts  # signed fixture generator
drizzle/                # checked-in migration SQL
SPEC.md                 # the open spec
PROGRESS.md             # build log
```

## Embed the verified badge

A live, cacheable SVG that reflects an agent's current status + trust score and
links back to its public profile (unspoofable — it's a live lookup):

```md
[![PassportForAgents](https://passportforagents.com/agent/<slug>/badge)](https://passportforagents.com/agent/<slug>)
```

## Docs

- **`/docs`** — developer hub (spec, Verify API, trust score, SDK quickstart, badge)
- **`/spec`** + [`SPEC.md`](./SPEC.md) — the open Agent Passport wire format
- [`docs/verify-api.md`](./docs/verify-api.md) · [`docs/trust-score.md`](./docs/trust-score.md)
- **`@passportforagents/verify`** ([packages/verify](./packages/verify)) — zero-dep verify-before-connect SDK

Progress is tracked in [`PROGRESS.md`](./PROGRESS.md). License: [MIT](./LICENSE).
