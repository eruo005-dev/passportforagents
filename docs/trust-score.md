# The PassportForAgents Trust Score

The trust score is a **transparent, documented weighted sum** of independently
verified signals — never a black box, never self-reported vanity metrics. The
score and its full per-signal breakdown are shown on every public profile and
returned by the Verify API.

## Formula

```
score = round( 100 × Σ ( value[type] × weight[type] ) )      // clamped to [0,100]
```

- `value[type]` ∈ [0,1] — the normalized signal (1 = best, 0 = worst/absent).
- `weight[type]` — the fixed weight below. Weights sum to **1.0**, so an agent
  with every signal at `value = 1` scores **100**, and one with no signals scores **0**.
- Absent signals contribute 0.

## Weights (v1)

| Signal | Weight | Meaning of `value = 1` |
| ------ | -----: | ---------------------- |
| `domain_control`    | 0.30 | Domain control proven (DNS TXT or signed `.well-known`). |
| `signed_provenance` | 0.20 | A valid Ed25519 signature over the passport verified against the declared key. |
| `secret_hygiene`    | 0.20 | A scan of the claimed domain's well-known paths found **no** exposed secrets. `0` = an exposed secret was found. |
| `uptime`            | 0.10 | Health checks consistently pass (populated by a later sprint). |
| `registry_presence` | 0.10 | Present in a mirrored public registry (later sprint). |
| `user_rating`       | 0.10 | Aggregated rating from **verified owners** only. |

`domain_control` carries the most weight: per the product principles, no proven
domain control should ever yield a high score.

## Anti-gaming rules

- **Self-asserted claims carry zero weight until independently checked.** Any
  unverified claim is stored with `value = 0`.
- One review per verified owner per agent; reviews from unverified accounts do
  not feed `user_rating`.
- The formula is fixed in code (`src/lib/trust/weights.ts`) and this document;
  a test asserts the two cannot drift.

> The weight table above is the single source of truth alongside
> `TRUST_WEIGHTS`. Any change is a deliberate code edit **and** a doc edit.
