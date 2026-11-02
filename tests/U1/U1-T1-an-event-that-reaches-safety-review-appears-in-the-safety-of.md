# U1-T1 — An event that reaches Safety Review appears in the Safety Officer's queue

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T1 |
| Test Scenario | An event that reaches Safety Review appears in the Safety Officer's queue |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 except that E1 is Approved, plus E2 (Planning) and E3 (Confirmed). |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` (F5).<br>2. As SO, send `GET /api/v1/safety-reviews`.<br>3. As SO, send `GET /api/v1/events/<E2>/safety-review`. |
| Test Data | Actors C1, SO. |
| Expected Result | F5 moves E1 to Safety Review. The queue lists E1 with its reference, name, expected attendance, period and assigned coordinator, and does not list E2 or E3. The review of E2 is refused with HTTP 409 `STATUS_TRANSITION_NOT_PERMITTED` naming Planning. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | F5 moved E1 to Safety Review; the queue listed E1 with its reference, name, attendance 120 and assigned coordinator C1 and no decision, and did not list the Planning or Confirmed events; the review of the Planning event was refused with 409 STATUS_TRANSITION_NOT_PERMITTED naming Planning. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 042f2d5 · Evidence: backend/services/planning-core/tests/change/api/u1Cards.test.ts › U1-T1 an event that reaches Safety Review appears in the Safety Officer's queue, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839 · Defect: — (that run's integration job fails only on tests/race/invariants.test.ts L3-T17, a fixed-date test outside U1; every U1 card passed) |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
