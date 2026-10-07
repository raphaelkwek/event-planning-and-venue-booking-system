# F1 — Completion in planning-core, with CR-06

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. This plan
> is a *delta* on `2026-09-30-f1-status-lifecycle.md`: it adds Task A, and re-targets that plan's
> Tasks 3–12 to the code's new home. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Finish F1. It was marked Done on 4 Oct with only Tasks 1–2 of 12 built. Add CR-06's Safety
Review on the way.

**Why a delta:** PR #3 (EN-01) moved the event code into `planning-core` without changing behaviour,
and CR-06 (Week 7) changed F1's lifecycle. The original plan's design still holds; its paths,
three details of its code, and the confirmation transition do not.

---

## Decisions this plan rests on

- **CR-06 transitions.** F5's confirmation of the arrangements leads to **Safety Review**. The Safety
  Officer's approval (U1) leads to **Confirmed**. A request for changes (U1) leads back to
  **Planning**. **Rejecting the safety arrangement gets no transition**: its outcome waits on the
  customer's answer to CQ-08. Raphael agreed on 2026-10-07.
- **Action names.** `CONFIRM` becomes `CONFIRM_ARRANGEMENTS`, since its target is no longer Confirmed.
  The new actions are `APPROVE_SAFETY` and `REQUEST_SAFETY_CHANGES`. Nothing has ever recorded
  `CONFIRM` (F5 isn't built), so the rename leaves no stale history.
- **F1 defines the transitions; F5 and U1 perform them.** Exposing `transitionEvent` through
  `modules/event/index.ts` for the change module is F5's and U1's job, not this plan's.
- **Two PRs.** `main` is protected (SPM-115): one approval and three green checks.
  - **PR 1 — CR-06 (Task A).** Small, and it touches `contracts`, which needs a second service
    owner's review (`implementation.md` §2).
  - **PR 2 — the write path, the sweep, the cards (Tasks 3–12).** The cards are executed against
    PR 2's branch before it merges, and their records carry its SHA.
- **Do not run migrations against the shared Supabase database from a feature branch.** CI applies
  them to a throwaway Postgres. Migration 0007 reaches the shared database after PR 1 merges.

## Translation rules for Tasks 3–12

Every task file handed to an implementer has already had these applied. They're listed so a
reviewer can check them.

| Original plan | Now |
|---|---|
| `backend/services/event/src/<x>` | `backend/services/planning-core/src/modules/event/<x>` |
| `backend/services/event/tests/<x>` | `backend/services/planning-core/tests/event/<x>` |
| `backend/services/event/tests/support/<x>` | `backend/services/planning-core/tests/support/<x>` (shared by every module) |
| `tests/architecture/statusWrites.test.ts` | `tests/event/architecture/statusWrites.unit.test.ts`, so CI's unit job runs it |
| `npm test -w @connectsphere/event-service` | `npm test -w @connectsphere/planning-core` |
| `cd backend/services/event && npx vitest run tests/<x>` | `cd backend/services/planning-core && npx vitest run tests/event/<x>` |
| `npx tsc -p backend/services/event/tsconfig.json --noEmit` | `npm run typecheck -w @connectsphere/planning-core` |
| `EVENT_TOPICS.<anything>` | `KAFKA_TOPICS.event` (one topic per aggregate since EN-04), imported from `@connectsphere/contracts` |
| `import { config } from "../config.js"` and `config.coordinatorPool` | `import { eventConfig } from "../config.js"` and `eventConfig.coordinatorPool` |
| `import { sql } from "../db.js"` and `import { logger } from "../logger.js"` (runner) | `../../../shared/db.js` and `../../../shared/logger.js` |
| Fixed proposed dates in API tests (`2026-12-02T…`) | `EVENT_START` / `EVENT_END` from `tests/support/eventDates.ts` (B2 refuses past starts) |
| `transitionRule("CONFIRM")` | `transitionRule("CONFIRM_ARRANGEMENTS")` (after Task A) |
| Root script path `backend/services/event/src/jobs/runCompleteEvents.ts` | `backend/services/planning-core/src/modules/event/jobs/runCompleteEvents.ts` |

**Gates before every commit**, in addition to the task's own steps:
- `npm run lint` from the repo root (eslint, `lint:boundaries`, `lint:api`);
- `npm run test:unit -w @connectsphere/planning-core`, which enforces 100% coverage of domain code.

---

### Task A: CR-06 — the Safety Review status (PR 1)

**Files:**
- Modify: `backend/packages/contracts/src/eventStatus.ts`
- Create: `backend/services/planning-core/migrations/event/0007_add_safety_review_status.sql`
- Create: `backend/services/planning-core/tests/boundaries/eventValues.test.ts`
- Modify: `backend/services/planning-core/src/modules/event/domain/statusMachine.ts`
- Modify: `backend/services/planning-core/tests/event/domain/statusMachine.test.ts`
- Modify: `backend/services/planning-core/tests/event/domain/statuses.test.ts`
- Modify: `documentation/api/planning-core.openapi.yaml` (the `EventStatus` enum)
- Modify: `frontend/src/api/types.ts`, `frontend/src/shared/status.ts`
- Modify / create: `tests/F1/` cards (Step 7)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Write the failing tests**

`backend/services/planning-core/tests/event/domain/statuses.test.ts`: replace the `it` with:

```ts
  it("are exactly the eleven the story names", () => {
    expect(EVENT_STATUSES.map((status) => EVENT_STATUS_LABELS[status])).toEqual([
      "Draft",
      "Submitted",
      "Under Review",
      "Awaiting Clarification",
      "Approved",
      "Planning",
      "Safety Review",
      "Confirmed",
      "Completed",
      "Cancelled",
      "Rejected",
    ]);
  });
```

`backend/services/planning-core/tests/event/domain/statusMachine.test.ts`:
- In `EXPECTED`, replace the `CONFIRM` entry with these three:

```ts
  CONFIRM_ARRANGEMENTS: { from: ["APPROVED", "PLANNING"], to: "SAFETY_REVIEW" },
  APPROVE_SAFETY: { from: ["SAFETY_REVIEW"], to: "CONFIRMED" },
  REQUEST_SAFETY_CHANGES: { from: ["SAFETY_REVIEW"], to: "PLANNING" },
```

- Replace the `describe("CONFIRM and COMPLETE (F1)", …)` block with:

```ts
describe("Safety Review, Confirmed and Completed (F1, CR-06)", () => {
  const actions = Object.keys(EXPECTED) as EventAction[];

  it("reaches Safety Review when F5 confirms the arrangements", () => {
    expect(transitionRule("CONFIRM_ARRANGEMENTS")).toEqual({
      from: ["APPROVED", "PLANNING"],
      to: "SAFETY_REVIEW",
    });
  });

  it("reaches Confirmed only through the Safety Officer's approval", () => {
    expect(actions.filter((action) => transitionRule(action).to === "CONFIRMED")).toEqual([
      "APPROVE_SAFETY",
    ]);
  });

  it("returns the event to Planning when the Safety Officer requests changes", () => {
    expect(transitionRule("REQUEST_SAFETY_CHANGES")).toEqual({
      from: ["SAFETY_REVIEW"],
      to: "PLANNING",
    });
  });

  it("has no transition for rejecting the safety arrangement until CQ-08 is answered", () => {
    expect(
      actions.filter(
        (action) =>
          transitionRule(action).from.includes("SAFETY_REVIEW") && transitionRule(action).to === "REJECTED"
      )
    ).toEqual([]);
  });

  it("completes only a Confirmed event", () => {
    expect(transitionRule("COMPLETE")).toEqual({ from: ["CONFIRMED"], to: "COMPLETED" });
  });

  it("refuses completing an Approved event, which was never confirmed", () => {
    const result = evaluateTransition("APPROVED", "COMPLETE");

    expect(result.permitted).toBe(false);
    if (result.permitted) throw new Error("expected a refusal");
    expect(result.message).toBe("This event is Approved and cannot move to Completed.");
  });
});
```

Create `backend/services/planning-core/tests/boundaries/eventValues.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EVENT_STATUSES } from "@connectsphere/contracts";
import { checkedValues, readMigration } from "../support/checkConstraints.js";

/** The event status check lists exactly what contracts lists (implementation.md §4.1). */

const migration = readMigration("migrations/event/0007_add_safety_review_status.sql");

describe("event migration 0007 and contracts", () => {
  it("allows exactly the event statuses contracts lists", () => {
    expect(checkedValues(migration, "status", "add constraint events_status_check")).toEqual([
      ...EVENT_STATUSES,
    ]);
  });
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `cd backend/services/planning-core && npx vitest run --config vitest.unit.config.ts tests/event/domain tests/boundaries/eventValues.test.ts`
Expected: FAIL. There are ten statuses, not eleven. `CONFIRM_ARRANGEMENTS`, `APPROVE_SAFETY` and `REQUEST_SAFETY_CHANGES` aren't actions yet (a TypeScript error in `EXPECTED`, plus undefined rules). Migration 0007 doesn't exist.

- [ ] **Step 3: Contracts — `backend/packages/contracts/src/eventStatus.ts`**

Insert `"SAFETY_REVIEW",` directly after `"PLANNING",` in **both** `EVENT_STATUSES` and `DECIDED_STATUSES`. A Safety Review event already carries its approval, so it can't be decided again. Add `SAFETY_REVIEW: "Safety Review",` directly after `PLANNING: "Planning",` in `EVENT_STATUS_LABELS`. Update the comment above `EVENT_STATUSES` to read: `The permitted event statuses (F1; CR-06 adds Safety Review).`

- [ ] **Step 4: Migration — `backend/services/planning-core/migrations/event/0007_add_safety_review_status.sql`**

First confirm the constraint's name. In 0001 it's an inline column check, so Postgres named it `events_status_check`. Check that `grep -n "status " backend/services/planning-core/migrations/event/0001_init_event_schema.sql` shows an unnamed inline check, and stop and report if it's named differently.

```sql
-- CR-06 (Week 7): the Safety Review status, between Planning and Confirmed.
-- F5's confirmation of the arrangements leads to it; the Safety Officer's
-- approval (U1) leads on to Confirmed. The permitted values live in contracts
-- (EVENT_STATUSES), and tests/boundaries/eventValues.test.ts holds this check
-- to exactly that list.
--
-- Added NOT VALID and then validated, so the new check is added without
-- holding a lock that blocks writes while every row is checked.
alter table event.events drop constraint events_status_check;

alter table event.events add constraint events_status_check
  check (status in (
    'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'AWAITING_CLARIFICATION',
    'APPROVED', 'PLANNING', 'SAFETY_REVIEW', 'CONFIRMED', 'COMPLETED',
    'CANCELLED', 'REJECTED'
  )) not valid;

alter table event.events validate constraint events_status_check;
```

**Don't run it against the shared database.** CI applies it to a throwaway Postgres.

- [ ] **Step 5: The transition table — `backend/services/planning-core/src/modules/event/domain/statusMachine.ts`**

In `EventAction`, replace `| "CONFIRM"` with:

```ts
  | "CONFIRM_ARRANGEMENTS"
  | "APPROVE_SAFETY"
  | "REQUEST_SAFETY_CHANGES"
```

In `TRANSITIONS`, replace the `CONFIRM` row and its comment with:

```ts
  // F5 confirms the arrangements (a confirmed booking, equipment reserved).
  // Since CR-06 that leads to Safety Review, not straight to Confirmed.
  CONFIRM_ARRANGEMENTS: { from: ["APPROVED", "PLANNING"], to: "SAFETY_REVIEW" },
  // U1 — only the Safety Officer's approval makes an event Confirmed (CR-06).
  APPROVE_SAFETY: { from: ["SAFETY_REVIEW"], to: "CONFIRMED" },
  // U1 — a request for changes sends the event back to Planning, from where it
  // passes F5 and the safety check again. Rejecting the safety arrangement has
  // no row: its outcome waits on the customer's answer to CQ-08.
  REQUEST_SAFETY_CHANGES: { from: ["SAFETY_REVIEW"], to: "PLANNING" },
```

In the file's header comment, change `Later stories (F3 cancellation, S2)` to `Later stories (F3 cancellation, S2, U1's reject once CQ-08 is answered)`.

- [ ] **Step 6: The API contract and the screens**

- `documentation/api/planning-core.openapi.yaml`, `EventStatus`: insert `SAFETY_REVIEW` after `PLANNING` in the enum, and change its description to `F1's exhaustive list (CR-06 adds SAFETY_REVIEW).`
- `frontend/src/api/types.ts`: add `| "SAFETY_REVIEW"` after `| "PLANNING"` in `EventStatus`.
- `frontend/src/shared/status.ts`: add `SAFETY_REVIEW: "Safety Review",` after `PLANNING` in `STATUS_LABELS`, and `SAFETY_REVIEW: "inprogress",` after `PLANNING` in `STATUS_APPEARANCE`. It's work in progress, like Planning.

- [ ] **Step 7: The cards**

- `git mv tests/F1/F1-T1-status-outside-the-ten-refused.md tests/F1/F1-T1-status-outside-the-permitted-ones-refused.md`. In it, change the title and Test Scenario to "The database refuses a status outside the permitted statuses". Add under the specification:
  > **Revised 2026-10-07 for CR-06**, which adds Safety Review: there are now eleven permitted statuses. The steps and expected result are unchanged.
- `tests/F1/F1-T7-confirming-writes-history.md`: title and scenario become "Confirming the arrangements moves the event to Safety Review and writes a history entry". The Expected Result becomes: "The row reads `APPROVED` → `SAFETY_REVIEW`, the coordinator's user id, `EVENT_COORDINATOR`, `CONFIRM_ARRANGEMENTS`, and a non-empty `occurred_at`." Add a "Revised 2026-10-07 for CR-06" note saying confirmation now leads to Safety Review, and only the Safety Officer's approval (U1) leads to Confirmed. Keep it Not Executed until F5.
- Create `tests/F1/F1-T12-safety-approval-confirms.md` and `tests/F1/F1-T13-safety-changes-return-to-planning.md` from `tests/TEMPLATE.md`. Each has: pre-condition FX-SEEDED with status `'SAFETY_REVIEW'` and end `now() + interval '30 days'`; steps "sign in as the Safety Officer and record the decision using U1's action", then the history query from F1-T7. Expected:
  - **T12:** status `CONFIRMED`; history `SAFETY_REVIEW` → `CONFIRMED`, the Safety Officer's id, `SAFETY_OFFICER`, `APPROVE_SAFETY`.
  - **T13:** status `PLANNING`; history `SAFETY_REVIEW` → `PLANNING`, `SAFETY_OFFICER`, `REQUEST_SAFETY_CHANGES`.

  Both have Status **Not Executed** and Remarks "Awaiting U1 (the Safety Officer's decision action)". Created By "Raphael", Date of Creation 2026-10-07.

- [ ] **Step 8: Verify**

From the repo root: `npm run lint`, `npm run typecheck`, `npm run test:unit -w @connectsphere/planning-core` (domain coverage must stay at 100%), and `npm run build`. All must pass. `git diff --check` must be clean.

- [ ] **Step 9: Commit**

```bash
git add -A backend/packages/contracts backend/services/planning-core documentation/api frontend/src tests/F1
git commit -m "feat(f1): add Safety Review to the status lifecycle (CR-06)

F5's confirmation now leads to Safety Review; only the Safety Officer's
approval leads to Confirmed, and a request for changes returns the event
to Planning. Rejecting the safety arrangement has no transition until
the customer answers CQ-08. The new status is in contracts, the database
check, the API contract and the screens, and a boundary test holds the
check to the contracts list.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

The CHANGELOG entry and the PR are done by the controller, not the implementer.

---

### Tasks 3–12

As in `2026-09-30-f1-status-lifecycle.md`, with the translation rules above applied, and these
adjustments:

- **Task 3** (`updateStatusIf`) — unchanged apart from paths.
- **Task 4** (`transitionEvent`) — unchanged apart from paths.
- **Tasks 5, 6, 8** — every `EVENT_TOPICS.x` in the replacement code is `KAFKA_TOPICS.event`, and
  `submitEvent.ts` uses `eventConfig`. Compare each replacement against the current file before
  pasting it, and keep anything the move added that the plan's code lacks.
- **Task 9** — the guard is `tests/event/architecture/statusWrites.unit.test.ts`, and its `SRC` is
  `join(__dirname, "../../../src/modules/event")`.
- **Task 10** — tests in `tests/event/jobs/`.
- **Task 11** — the runner imports `sql` and `logger` from `../../../shared/`. The root script path
  is in the table above.
- **Task 12** — F1 now has thirteen cards; F1-T7, F1-T12 and F1-T13 stay Not Executed (awaiting F5
  and U1). Traceability: one row for each of F1's **seven** criteria in `sprint-2.csv`, including
  CR-06's (cited by "reaches Confirmed only through the Safety Officer's approval"). PR 2 replaces
  the original Task 12's "open a PR" step.
