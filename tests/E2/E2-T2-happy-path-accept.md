# E2-T2 — The nominee accepts a reassignment proposal

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T2 |
| Test Scenario | The nominee accepts; the outgoing assignment closes, the nominee becomes the active coordinator, and the organiser sees the updated point of contact |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed. |
| Test Steps | 1. Sign out, sign in as the nominee coordinator.<br>2. Open the request from the review queue.<br>3. Under "Coordinator assignment", click "Accept". |
| Test Data | — |
| Expected Result | "Assigned coordinator" now shows the nominee. The nominee can now Approve/Reject the request; the previous coordinator no longer can (their "Propose reassignment" button and decision buttons are for a request they are no longer assigned to). Signing in as `organiser@connectsphere.test` and opening the request shows the nominee as "Assigned coordinator". `select is_active from event.assignments where event_id = '<id>' and coordinator_id = '<outgoing id>'` is `false`; the row for the nominee is `true`. |
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After accepting, "Assigned coordinator" reads "Coordinator Two" and the nominee can Approve or Reject. The outgoing row (Coordinator One) is is_active false and the nominee's is true, and the organiser sees "Coordinator Two" as their point of contact. |
| Status | Blocked |
| Remarks | Retired by E4 (W9-FX-5, W9-59): coordinators no longer propose or accept a reassignment; the Lead reassigns (E4). Proposing and accepting answer 410 REASSIGNMENT_RETIRED, and migration event/0020 closed every pending proposal, so this case can no longer be run. The 2026-09-20 manual Pass is kept as it was: Commit: b0ef6ee (working tree modified) · Evidence: tests/E2/evidence/E2-T2.png · Defect: — · Not rerun |
| Executed By | Sahanya |
| Date of Execution | 2026-09-20 |
