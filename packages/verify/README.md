# @passportforagents/verify

**Verify before connect.** A zero-dependency SDK for MCP clients and gateways to
check that an agent is who it claims to be *before* trusting it — either fully
locally, or via the hosted PassportForAgents Verify API.

Zero npm dependencies: Ed25519 verification uses the platform WebCrypto (Node
18+, Deno, edge, modern browsers); base58 + RFC 8785 JCS are inlined.

## Standalone (no hosted service)

```ts
import { verifyStandalone } from "@passportforagents/verify";

const result = await verifyStandalone("example.com");
if (result.valid) {
  // Fetched https://example.com/.well-known/agent-passport.json,
  // verified the Ed25519 signature over the JCS body, and confirmed the
  // serving host matches owner_domain — all locally.
  console.log(result.document?.agent_name, result.document?.capabilities);
}
```

## Hosted (identity + status + trust score)

```ts
import { verifyHosted } from "@passportforagents/verify";

const r = await verifyHosted({ agent: "acme-mcp-acme-dev", apiKey: process.env.PFA_KEY! });
if (r.ok && r.verified) {
  console.log(r.agent?.owner_domain, r.trust?.score); // e.g. "acme.dev", 70
}
```

## Gateway pattern

```ts
const r = await verifyStandalone(serverDomain);
if (!r.valid) throw new Error("refusing to connect: unverified agent");
```

MIT-licensed. The wire format spec lives in the main repo's `SPEC.md`.
