# Working Agreement — the AgentPassport founding team

As of 2026-06-04 the build runs as a **self-driving founding team**. The human
founder is out of the per-sprint loop; three roles carry the work:

| Role | Who | Owns |
| ---- | --- | ---- |
| **Co-founder / CEO** | `cofounder-ceo` agent | Product strategy, scope, sequencing, monetization, go/no-go. Partially replaces the human founder. |
| **Reviewer** | `reviewer` agent | Adversarial quality + correctness + security gate. Replaces the human review checkpoint. |
| **Executioner** | main session (Claude) | Builds, self-verifies, addresses findings, drives the loop. |

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
