# E2-T6 — A second proposal while one is pending is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T6 |
| Test Scenario | Only one pending reassignment proposal may exist per event at a time; a second proposal is refused and identifies the pending nominee |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed (so a proposal to `coordinator2@connectsphere.test`, say, is already pending). |
| Test Steps | 1. Stay signed in as the outgoing coordinator (the page still shows "Propose reassignment" is unavailable once a proposal is pending, so re-attempt via the API console: `POST /event/api/v1/events/<id>/reassignment-proposals` with body `{ "nomineeId": "<a third coordinator id, if seeded, or the same nominee>" }`).<br>2. Send the request. |
| Test Data | The pending event's id; any nominee id. |
| Expected Result | `409 REASSIGNMENT_ALREADY_PENDING`, with a message naming the currently pending nominee's id. The original pending proposal is unchanged. |
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HTTP 409 REASSIGNMENT_ALREADY_PENDING, naming the pending nominee 00000000-0000-0000-0000-000000000008: "A reassignment proposal to nominee 00000000-0000-0000-0000-000000000008 is already pending for this event.". The original proposal is unchanged and still PENDING. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/E2/evidence/E2-T6.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
