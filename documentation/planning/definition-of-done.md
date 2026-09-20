# Definition of Done — Sprint 1

**Status:** Proposed — needs team sign-off before it's binding.
**Applies to:** Sprint 1 (Weeks 4–5). See "From Sprint 2 onward" at the bottom for what changes once the
curriculum covers automated/scripted testing.

## Why this differs from `Planning/implementation.md` §8.3

§8.3 assumes automated testing (Vitest, Playwright, `traceability.csv`) as the primary gate. That's
ahead of where the curriculum is for Sprint 1 — we haven't covered scripted testing yet, so the
required, gradable evidence for Sprint 1 is **manual functional test cases**, recorded per feature
using the professor's test case template. Any automated tests already in the codebase are a bonus
safety net on top of this — keep them green, but a passing `npm test` does not by itself satisfy
this DoD.

## Checklist — every Sprint 1 story

A story is Done when all of the following are true:

- [ ] Code merged to `main`.
- [ ] Every acceptance criterion has at least one manual test case, written with the template below
      *before* it's run.
- [ ] The happy path **and** at least one negative/invalid-input case are both covered (e.g. for a
      login story: valid credentials, plus wrong password or a deactivated account — not success
      alone).
- [ ] **If the story is cross-cutting** — another story depends on it, or it involves a
      service-to-service call per `Planning/plan.md` §5 (e.g. A3's access-scope check, D1's move
      from Submitted to Under Review, B1's notification event) — at least one test case exercises
      the integrated path
      end-to-end, not just the story in isolation. This is what actually shows the integration works,
      not just the individual piece.
- [ ] Every test case has been executed and recorded: Actual Result, Status, Executed By, Date of
      Execution. Nothing left at "Not Executed."
- [ ] **Every executed test case's Status is Pass.** A Fail means the story is not Done — fix it,
      then record a *new* execution entry (don't overwrite the failed one; the history of a
      Fail-then-Pass is worth keeping).
- [ ] Demonstrated to the Product Owner in the sprint review, walked through live using the recorded
      test cases as the script.
- [ ] The story's Jira ticket and its Test issue(s) are moved to Done.

## Test case template

*(spec — written once, before the test case is run)*

| Field | Meaning |
|---|---|
| Test Case ID | The story's Jira Test issue key, e.g. `A1-T1`. |
| Test Scenario | One-line objective — what this test case is checking. |
| Pre-conditions | What must already be true (seed data, logged-out state, a specific account). |
| Test Steps | Numbered, step-by-step, specific enough that anyone on the team can follow it. |
| Test Data | The exact inputs used. |
| Expected Result | What should happen if the feature is correct. |
| Created By | — |
| Date of Creation | — |

*(execution record — one per run; append a new record each re-run rather than editing the last one)*

| Field | Meaning |
|---|---|
| Actual Result | What actually happened. |
| Status | Pass / Fail / Not Executed / Blocked. |
| Remarks | Anything notable — a workaround used, a bug filed, why it's Blocked. |
| Executed By | — |
| Date of Execution | — |

## Where test cases live

**Placeholder — a teammate is doing a documentation/repo cleanup pass soon and will settle this
properly.** Until then: `documentation/test-cases/sprint-1.csv`, one row per execution (so a
Fail-then-Pass re-run is two rows, not an overwrite), columns matching the template above —
`test_case_id, story_id, scenario, preconditions, steps, test_data, expected_result, created_by,
date_created, actual_result, status, remarks, executed_by, date_executed`. Not tied to any
particular Jira issue structure, so it survives however Jira gets reorganized.

## From Sprint 2 onward

Once the curriculum introduces automated/scripted testing, `Planning/implementation.md` §8.1–§8.3
(Vitest/Playwright, `traceability.csv`, CI-gated merges) take over as the primary DoD, and this
manual-test-card process either steps back to a supplementary check or is retired — whichever the
team agrees at that point. This document is Sprint 1-specific by design, not a permanent process.
