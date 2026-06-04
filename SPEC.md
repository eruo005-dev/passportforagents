# The Agent Passport Specification

**Version:** `0.1.0`
**Status:** Draft
**License:** MIT (see `LICENSE`)

Agent Passport is an open, self-verifiable identity format for AI agents —
beginning with MCP servers. It answers one question with a single HTTPS fetch
and a signature check: **is this agent who it claims to be?**

The trust model is deliberately the same one that already secures the web
(TLS/DKIM): **control of a domain + a valid cryptographic signature = identity.**
No blockchain, no DID method, no central registry is required to *verify* a
passport. The hosted PassportForAgents service is a convenience and reputation layer
on top of this open primitive — not a dependency of it.

---

## 1. Overview

An agent operator publishes a signed JSON document at a well-known URL on a
domain they control:

```
https://<owner_domain>/.well-known/agent-passport.json
```

A verifier:

1. Fetches the document over **HTTPS** from the claimed domain.
2. Removes the `signature` field and **canonicalizes** the remaining body using
   RFC 8785 (JCS).
3. Verifies the detached **Ed25519** signature against the document's declared
   `public_key`.
4. Confirms the **host that served the file matches `owner_domain`**.

If all four hold, the agent's identity is confirmed: whoever controls
`owner_domain` also controls the signing key, and the document has not been
tampered with.

---

## 2. The document

### 2.1 Fields

| Field          | Type       | Required | Description                                                                 |
| -------------- | ---------- | -------- | --------------------------------------------------------------------------- |
| `spec_version` | string     | yes      | Spec version, e.g. `"0.1.0"` (semver).                                       |
| `agent_name`   | string     | yes      | Human-readable name of the agent.                                            |
| `agent_type`   | string     | yes      | `"mcp_server"` or `"a2a_agent"`.                                             |
| `owner_domain` | string     | yes      | The domain controlling this identity. MUST match the serving host.          |
| `public_key`   | string     | yes      | Ed25519 public key as a **multibase Multikey** (see §3).                     |
| `capabilities` | string[]   | yes      | Declared capabilities (e.g. MCP method names, tool names). May be empty.     |
| `homepage`     | string     | no       | Project homepage URL.                                                        |
| `repo`         | string     | no       | Source repository URL.                                                       |
| `issued_at`    | string     | yes      | RFC 3339 timestamp of issuance/signing.                                      |
| `signature`    | string     | yes      | Detached signature over the JCS-canonicalized body (see §4). **Excluded from the signed bytes.** |

### 2.2 Example

```json
{
  "spec_version": "0.1.0",
  "agent_name": "Example MCP Server",
  "agent_type": "mcp_server",
  "owner_domain": "example.com",
  "public_key": "z6Mk...",
  "capabilities": ["tools/list", "tools/call", "resources/read"],
  "homepage": "https://example.com",
  "repo": "https://github.com/example/mcp-server",
  "issued_at": "2026-06-04T00:00:00Z",
  "signature": "z3yQ..."
}
```

---

## 3. Key & signature encoding

### 3.1 Public key — multibase Multikey

The public key is a `did:key`-compatible **Multikey**:

```
public_key = "z" + base58btc( multicodec(ed25519-pub) || rawPublicKey )
```

- `multicodec(ed25519-pub)` is the varint `0xed 0x01`.
- `rawPublicKey` is the 32-byte Ed25519 public key.
- The result is base58btc-encoded and prefixed with multibase code `"z"`.

Encoding the key with a self-describing multicodec prefix is what lets the
identity primitive be **swapped later** (a different key type carries a different
multicodec) without changing the document shape or the registry/reputation
layers.

### 3.2 Signature — base58btc multibase

```
signature = "z" + base58btc( rawSignature )
```

Where `rawSignature` is the 64-byte Ed25519 signature. (No multicodec prefix;
the algorithm is implied by the key type.)

---

## 4. Canonicalization & signing

The signature covers **every field except `signature`**.

**To sign:**

1. Build an object containing all fields except `signature`.
2. Canonicalize it with **RFC 8785 (JCS)**: object members sorted by their key's
   UTF-16 code units, minimal JSON string escaping, ECMAScript number form, no
   insignificant whitespace.
3. UTF-8 encode the canonical string → message bytes.
4. Ed25519-sign the message bytes with the secret key.
5. Encode the 64-byte signature per §3.2 and add it as the `signature` field.

**To verify:**

1. Parse the document; extract and remove `signature`.
2. Canonicalize the remaining body (step 2 above) → message bytes.
3. Decode `public_key` (§3.1) → 32 raw bytes; decode `signature` (§3.2) → 64 raw bytes.
4. Ed25519-verify.
5. Confirm the serving host matches `owner_domain` (host comparison is
   case-insensitive; a leading `www.` and any port are ignored).

A verifier MUST refuse off-domain redirects when fetching the document — a
redirect to another host would break the domain-control guarantee.

---

## 5. Verification levels

| Level             | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `unverified`      | No successful check on record.                                          |
| `domain_verified` | Domain control proven (DNS TXT, `.well-known` HTTPS, or GitHub).        |
| `key_verified`    | A valid signature over the passport body verified against `public_key`. |
| `suspended`       | Administratively disabled.                                              |

A passport that passes §4 end-to-end reaches at least `key_verified`.

---

## 6. Reference verifier

A standalone, dependency-light reference verifier lives at `spec/verify.mts`.
It has **zero dependence on the hosted PassportForAgents service** — it only needs
the document (fetched live or from a file) plus audited crypto libraries
(`@noble/ed25519`, `@noble/hashes`, `@scure/base`).

```bash
# Verify a live domain end-to-end (fetch + signature + domain match)
npm run verify -- example.com

# Verify a local file (signature only)
npm run verify -- --file spec/fixtures/agent-passport.json

# Verify a local file AND check it claims a given host
npm run verify -- --file spec/fixtures/agent-passport.json --host example.com
```

Exit code `0` = valid, `1` = invalid.

Generate a fresh signed fixture (and a tampered counter-example) with:

```bash
npm run fixture
```

---

## 7. Security considerations

- **HTTPS is mandatory.** The domain-control proof rests on TLS; plaintext HTTP
  is not acceptable.
- **No off-domain redirects** when fetching `agent-passport.json`.
- **Key rotation** is performed by publishing a new document with a new
  `public_key` and `issued_at`; verifiers always trust the currently-served
  document for the domain.
- **The signature does not cover transport.** It proves the body's integrity and
  the key-holder's intent; the domain match (served host == `owner_domain`) is
  what binds that key to the domain.
- Self-asserted fields (`capabilities`, `homepage`, …) are claims, not proofs.
  Reputation/trust scoring (a separate layer) independently checks what it can
  and assigns **zero weight to unverified self-assertions**.

---

## 8. Versioning

This spec uses semantic versioning via `spec_version`. Backward-incompatible
changes to the signed-body shape or canonicalization rules bump the major
version. The reference verifier advertises the versions it supports.
