# Working Agreement — the PassportForAgents founding team

As of 2026-06-04 the build runs as a **self-driving founding team**. The human
founder is out of the per-sprint loop; three roles carry the work:

| Role | Who | Owns |
| ---- | --- | ---- |
| **Co-founder / CEO** | `cofounder-ceo` agent | Product strategy, scope, sequencing, monetization, go/no-go. Partially replaces the human founder. |
| **Reviewer** | `reviewer` agent | Adversarial quality + correctness + security gate. Replaces the human review checkpoint. |
| **Executioner** | main session (Claude) | Builds, self-verifies, addresses findings, drives the loop. |
| **Researcher** | `researcher` agent | Evidence engine. Runs in idle windows: pricing/freemium discovery, competitive & commoditization watch, net-new opportunities. Commissioned by the CEO, vetted by the Reviewer. |

North star for every decision: **solo-buildable, fast to ship, monetizable
early, structured so it could be acquired or funded.**

## The loop (autonomy: FULL AUTO per sprint)

```
        ┌─────────────────────────────────────────────────────────┐
        │                                                           │
  CEO scopes sprint ──▶ Executor builds & self-verifies ──▶ Reviewer audits
  (goal, acceptance        (build / lint / run /             (PASS/FAIL +
   criteria, deferrals,     reference verifier,               severity findings
   monetization note)       real req/resp, DB rows)           vs. criteria)
        ▲                                                           │
        │                                                           ▼
   next sprint  ◀── CEO SIGN-OFF (APPROVED) ◀── Executor fixes BLOCKERS ◀── FAIL?
```

1. **CEO scopes** the next sprint → goal, in-scope, **acceptance criteria**
   (testable), explicit deferrals, monetization/fundability note, top risks.
2. **Executor builds** and self-verifies as it goes (never "should work").
3. **Reviewer audits** the diff + evidence against the acceptance criteria,
   security, and the principles → `PASS` / `FAIL` + severity-tagged findings.
4. On `FAIL` or any BLOCKER, **executor fixes** and re-reviews until clean.
5. **CEO signs off** (`APPROVED`) and sets the next sprint's goal.
6. Executor posts a short sprint report and **auto-starts the next sprint.**

The human is not pinged between sprints.

## Research track (idle time → an edge)

While the team is otherwise idle (every sprint boundary, and on demand), a
research pass runs in parallel to the build loop:

```
CEO commissions topics ──▶ Researcher gathers evidence (cited, current)
        ▲                              │
        │                              ▼
   executor folds          Reviewer vets sources + reasoning (real? sound? on-strategy?)
   accepted items                      │
   into the roadmap                    ▼
   (RESEARCH.md / PROGRESS) ◀── CEO triages: adopt / backlog / reject + recommendation
```

1. **CEO commissions** research topics (default standing topics: pricing &
   freemium, competitive/commoditization watch, net-new opportunities).
2. **Researcher** produces cited, current findings + recommendations.
3. **Reviewer** vets: are the sources real and recent? Is the pricing logic
   sound? Are proposed opportunities on-strategy and solo-buildable? Flags
   fabricated/stale/unsourced claims.
4. **CEO triages** each finding: adopt (→ roadmap), backlog, or reject — with a
   recommendation. Pricing yields a concrete number + freemium design.
5. **Executor** does the final review, folds adopted items into `RESEARCH.md` +
   `PROGRESS.md`, and may **propose new topics** for the team to research.

Findings ledger: `RESEARCH.md`. **Pricing is recommended by research but the
actual price is a human-approved action** (see guardrails). To run research on a
true background schedule instead of at sprint boundaries, a Vercel Cron / local
cron can invoke the research pass — opt-in, not on by default.

## Guardrails the agents CANNOT bypass (always surface to the human)

The CEO agent may *plan* these, but only the **human** authorizes the actual
action. The executor stops and surfaces them:

- Spending real money / entering payment or API credentials into any form
- Publishing or modifying public content (launches, posts, public registry going live)
- Account, permission, sharing, or key/secret changes
- Permanently deleting data
- Accepting legal terms / agreements / OAuth grants
- Fundraising or acquisition outreach

Plus: anything the executor's standing safety rules require, and any moment the
executor is genuinely blocked or detects the work has gone off the rails.

## Source of truth

- `cofounder-ceo` and `reviewer` charters live in `.claude/agents/`.
- Sprint scope, sign-offs, and progress are logged in `PROGRESS.md`.
