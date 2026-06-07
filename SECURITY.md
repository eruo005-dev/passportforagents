# Security Policy

PassportForAgents is identity and trust infrastructure, so we take security
seriously and appreciate responsible disclosure.

## Reporting a vulnerability

**Please do not open a public issue for security vulnerabilities.**

Email **security@passportforagents.com** with:

- a description of the issue and its impact,
- steps to reproduce (a proof-of-concept if possible), and
- any suggested remediation.

We aim to acknowledge reports within 72 hours and to keep you updated as we
investigate. We currently run a free open beta and do not offer a paid bug
bounty, but — with your permission — we credit reporters once a fix ships.

## Scope

**In scope:** the hosted service (`passportforagents.com`), the Verify API, the
trust-score and signed-attestation logic, the transparency-log construction, the
reference verifier, and the published spec.

**Out of scope:** third-party infrastructure we depend on (report those to the
respective vendor), volumetric denial-of-service, and findings that require a
compromised end-user device.

## Cryptographic design

Identity is **domain control + a detached Ed25519 signature** over an RFC 8785
(JCS) canonicalized document. **Private keys never reach our servers** — we store
only public keys, and API keys are stored as SHA-256 hashes. The trust score is a
transparent, independently recomputable weighted sum, and attestations carry the
evidence needed to verify them offline.

See [`SPEC.md`](./SPEC.md) for the full threat model and security considerations.
