# Verify API

`GET /api/v1/verify?agent=<slug-or-domain>`

Resolve an agent's identity, verification status, and trust score in one call.

## Auth

API-key required. Send either header:

```
Authorization: Bearer ap_live_xxx
x-api-key: ap_live_xxx
```

Create/revoke keys in the dashboard (`/dashboard/api-keys`). Keys are stored
hashed; the plaintext is shown once at creation.

## Response (200)

```json
{
  "agent": {
    "slug": "example-mcp-example-com",
    "name": "Example MCP Server",
    "type": "mcp_server",
    "owner_domain": "example.com",
    "public_key": "z6Mk…",
    "capabilities": ["tools/list", "tools/call"]
  },
  "status": "key_verified",
  "verified": true,
  "trust": { "score": 70, "breakdown": [ /* per-signal contributions */ ] },
  "checked_at": "2026-06-04T00:00:00.000Z"
}
```

> **Important — resolution does not imply verification.** An agent that has only
> *claimed* a domain (not yet proven control) is still resolvable by slug or
> domain. **Always check the `verified` boolean** (and `status`): `verified` is
> `true` only for `domain_verified` or `key_verified`. A `false`/`unverified`
> result means the self-asserted details are unproven — do not trust them.

## Status codes

| Code | Meaning |
| ---- | ------- |
| 200 | Found; see `status` + `verified`. |
| 400 | Missing `?agent=`. |
| 401 | Missing or invalid API key. |
| 404 | No agent matches the slug/domain. |
| 429 | Free monthly quota exceeded (`{ error, quota, used }`). |

Every authenticated call is metered (logged for billing + abuse throttling).
Responses are `no-store`. Only public identity fields are returned — never owner
email or keys.
