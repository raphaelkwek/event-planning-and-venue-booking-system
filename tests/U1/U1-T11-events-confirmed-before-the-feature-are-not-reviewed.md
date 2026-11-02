# U1-T11 — Events confirmed before the feature are not reviewed

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T11 |
| Test Scenario | Events confirmed before the feature are not reviewed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Event E3 is Confirmed, with no safety decision. |
| Test Steps | 1. As SO, send `GET /api/v1/safety-reviews`.<br>2. As SO, send `POST /api/v1/events/<E3>/safety-decision` with decision `APPROVE`.<br>3. As C1, send `POST /api/v1/events/<E3>/mark-confirmed`. |
| Test Data | Actors SO, C1. |
| Expected Result | E3 is not in the queue. The decision is HTTP 409 `STATUS_TRANSITION_NOT_PERMITTED` naming Confirmed and Safety Review, and Mark Confirmed is refused the same way. E3 stays Confirmed with nothing written. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | A Confirmed event with no decision was absent from the queue; a decision on it returned 409 STATUS_TRANSITION_NOT_PERMITTED naming Confirmed, and Mark Confirmed was refused the same way; nothing was written. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 042f2d5 · Evidence: backend/services/planning-core/tests/change/api/u1Cards.test.ts › U1-T11 events confirmed before the feature are not reviewed, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839 · Defect: — (that run's integration job fails only on tests/race/invariants.test.ts L3-T17, a fixed-date test outside U1; every U1 card passed) |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
