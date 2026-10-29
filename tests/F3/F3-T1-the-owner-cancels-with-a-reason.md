# F3-T1 — The owner cancels with a reason: Cancelled, with the reason, user and time recorded, and a history entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T1 |
| Test Scenario | O cancels E (Planning) with a reason that has spaces around it; the event becomes Cancelled and records why, by whom and when |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F3 from `tests/F3/README.md` is loaded. |
| Test Steps | 1. As O, send `POST /api/v1/events/<E>/cancellation` with the body below, noting the HTTP status and body.<br>2. Read E's row and its newest status history entry.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-T1 '` and read the named `F3-T1 ` result. |
| Test Data | `{"reason":"  The speaker withdrew.  "}` |
| Expected Result | Step 1 answers 200 with `event` `{status: CANCELLED, previousStatus: PLANNING, cancellationReason: "The speaker withdrew.", cancelledBy: O}` and a `cancelledAt`. E's row has status `CANCELLED`, `cancellation_reason` `The speaker withdrew.` (trimmed), `cancelled_by` O and `cancelled_at` equal to the response's. The newest history entry is `PLANNING` → `CANCELLED`, actor O, role `EVENT_ORGANISER`, action `CANCEL`. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for CI on the F3 pull request. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
