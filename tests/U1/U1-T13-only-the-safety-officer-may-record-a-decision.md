# U1-T13 — Only the Safety Officer may record a decision

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T13 |
| Test Scenario | Only the Safety Officer may record a decision |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded). |
| Test Steps | 1. As C1, C2, ORG, VS, TS, ATT and LEAD, send `POST /api/v1/events/<E1>/safety-decision` with decision `APPROVE`.<br>2. As the same actors, send `GET /api/v1/safety-reviews` and `GET /api/v1/events/<E1>/safety-review`.<br>3. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`. |
| Test Data | Actors C1, C2, ORG, VS, TS, ATT, LEAD. |
| Expected Result | Every request is HTTP 403 `ROLE_NOT_AUTHORISED`, checked on the server. Nothing was written. |
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
