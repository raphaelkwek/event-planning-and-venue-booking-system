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
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | The UI itself already prevents this (no "Propose reassignment" button while a proposal is pending), so this case exercises the server-side refusal directly via the API console per `tests/README.md`. Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
