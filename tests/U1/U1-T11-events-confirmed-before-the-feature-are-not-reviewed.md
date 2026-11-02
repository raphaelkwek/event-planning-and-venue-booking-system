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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
