# Contributing to PassportForAgents

Thanks for your interest. PassportForAgents is an open, MIT-licensed spec and
reference implementation — contributions to the spec, the verifier, the SDK, and
the hosted service are all welcome.

## Ground rules

- Be excellent to each other — see [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).
- For anything beyond a small fix, **open an issue first** so we can align.
- **Security issues** go to [`SECURITY.md`](./SECURITY.md), not a public issue.

## Dev setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase + Clerk keys
npm run db:migrate           # apply schema to your database
npm run dev                  # http://localhost:3000
```

## Before you push

CI runs three checks on every pull request — all must pass:

```bash
npm run lint        # ESLint
npx tsc --noEmit    # type check
npm test            # unit suite (pure — no DB or env needed)
```

Add tests for new behavior. Crypto and security code **must** include negative,
fail-closed cases (tampered input, wrong key, malformed proof, etc.).

## A note on Next.js

This project tracks a bleeding-edge Next.js where APIs may differ from older
releases. **Read the relevant guide in `node_modules/next/dist/docs/` before
writing framework code**, and heed deprecation notices. (See
[`AGENTS.md`](./AGENTS.md).)

## Commits & PRs

- Conventional-commit style is appreciated (`feat:`, `fix:`, `docs:` …).
- Keep PRs focused; describe what changed and how you verified it.
- The **spec is the contract**: any change to the on-the-wire format needs a
  `spec_version` bump and a written rationale, and must keep older documents
  verifiable.
