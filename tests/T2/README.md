# T2 — Read and manage my notifications

**Status: not built.** Sprint 1 was scoped to A1–E2; T2 is counted in Sprint 2
(`documentation/planning/plan.md` §9.1 and the Sprint 2 row of the plan's sprint table). Removing T1
put notification acceptance criteria on B1, D2–D5, E1 and E2, so those Sprint 1 stories must emit
the right message — but reading and managing notifications is T2's own work. Three pieces are
missing: the outbox relay that publishes to Kafka, the Notification Service that records a
notification per recipient, and the notifications screen.

Every case in this folder was split out of a story card on 2026-09-20. The trigger half of each
— that the state change emits the right message, to the right recipient, with the fields a
notification needs — stayed with the story that owns it and is executable today against
`event.outbox`:

| This case | Split from | Trigger asserted there |
|---|---|---|
| T2-T1 | B1-T5 | `event.submitted` |
| T2-T2 | D2-T7 | `event.clarification-requested` |
| T2-T3 | D3-T8 | `event.clarification-responded` |
| T2-T4 | D4-T5 | `event.approved` |
| T2-T5 | D5-T7 | `event.rejected`, carrying the reason |
| T2-T6 | E1-T2 | `event.coordinator-assigned` |

**Nothing here counts towards Sprint 1's Definition of Done**, and nothing here should be marked
`Blocked` — `Blocked` means a case that should be runnable now and isn't. These are `Not Executed`
against a story that has not been built yet, which is the ordinary state of a future sprint's cards.

Two things to do before these run:

- **Create the T2-T1…T2-T6 Test issues in Jira.** `tests/README.md` says a case's ID is its Jira
  Test issue key; these six IDs do not exist in Jira yet.
- **Re-check the expected results against T2's acceptance criteria when T2 is picked up.** These
  specifications were written for B1/D2–D5/E1 in September and describe the notification only as far
  as those stories needed it. T2 will have its own ACs — read state, dismissal, ordering — which
  these six cases do not cover.
