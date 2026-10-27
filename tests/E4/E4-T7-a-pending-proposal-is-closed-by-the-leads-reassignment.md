# E4-T7 — A peer proposal still pending when the Lead reassigns the event is closed, unaccepted

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T7 |
| Test Scenario | A peer proposal still pending when the Lead reassigns the event is closed, unaccepted |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-UNDER-REVIEW completed, then the FX-PROPOSAL statement (`tests/E4/README.md`): a pending proposal from Coordinator One to Coordinator Two, as one made before E2 was retired. |
| Test Steps | 1. As `lead@connectsphere.test`, reassign the request to Coordinator Two.<br>2. Run `select status, resolved_at from event.reassignment_proposals where event_id = '<id>';`.<br>3. Sign in as `coordinator2@connectsphere.test`, open the request and look for "Accept". |
| Test Data | The pending proposal |
| Expected Result | The proposal's status is CLOSED, with a resolved time; it was not accepted. Coordinator Two is the assigned coordinator, and no accept or decline is offered. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
