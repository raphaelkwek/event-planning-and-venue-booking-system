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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
