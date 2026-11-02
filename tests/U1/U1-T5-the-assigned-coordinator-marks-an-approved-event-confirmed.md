# U1-T5 — The assigned coordinator marks an approved event Confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T5 |
| Test Scenario | The assigned coordinator marks an approved event Confirmed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded).<br>3. SO has approved E1. |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/mark-confirmed`.<br>2. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`. |
| Test Data | Actor C1. |
| Expected Result | HTTP 200. E1 is Confirmed. The latest history entry reads Safety Review to Confirmed, C1's id, `EVENT_COORDINATOR`, `MARK_CONFIRMED`. An `event.status-changed` message is in the outbox. |
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
