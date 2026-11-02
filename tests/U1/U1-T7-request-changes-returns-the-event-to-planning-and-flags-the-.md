# U1-T7 — Request changes returns the event to Planning and flags the named arrangements

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T7 |
| Test Scenario | Request changes returns the event to Planning and flags the named arrangements |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded). |
| Test Steps | 1. As SO, send `POST /api/v1/events/<E1>/safety-decision` with decision `REQUEST_CHANGES`, the reason `Move the chairs away from the east exit`, and booking B1 and reservation R1 named as needing review.<br>2. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`. |
| Test Data | Actor SO. |
| Expected Result | HTTP 201. E1 is Planning. The decision row records `REQUEST_CHANGES`, the reason and the arrangements named. B1 carries a Requires Reconfirmation flag and R1 a Flagged for review flag, each with the Safety Officer's reason (S3's `GET /api/v1/events/<E1>/arrangement-flags` lists them). B1 stays Confirmed and R1 stays Reserved. The history entry reads Safety Review to Planning, `REQUEST_SAFETY_CHANGES`. |
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
