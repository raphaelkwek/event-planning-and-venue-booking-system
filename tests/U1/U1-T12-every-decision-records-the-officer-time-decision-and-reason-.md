# U1-T12 — Every decision records the officer, time, decision and reason, writes history and notifies

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T12 |
| Test Scenario | Every decision records the officer, time, decision and reason, writes history and notifies |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded). |
| Test Steps | 1. As SO, request changes on E1 with a reason.<br>2. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`.<br>3. Pass the stored `event.safety-decision-recorded` message through the notification service's recipient rule. |
| Test Data | Actor SO. |
| Expected Result | The decision row holds SO's id, the time, the decision and the reason. One F1 history entry and one `event.status-changed` message are written with it. The notification rule yields one notification for C1 and one for ORG, each naming the decision and the reason, and none for anyone else. |
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
