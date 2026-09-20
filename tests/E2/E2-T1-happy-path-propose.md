# E2-T1 — Propose reassignment to an eligible nominee

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T1 |
| Test Scenario | The active coordinator proposes reassignment to another coordinator; the event shows a visible pending-reassignment state, and the outgoing coordinator keeps all coordinator actions |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed, so the request already carries an active assignment. |
| Test Steps | 1. Sign out, sign in as the coordinator shown in "Assigned coordinator".<br>2. Open the request from the review queue.<br>3. Under "Coordinator assignment", click "Propose reassignment".<br>4. Enter the other seeded coordinator's user id (`tests/README.md` Accounts table).<br>5. Click "Send proposal". |
| Test Data | Nominee user id: the seeded coordinator account that is *not* the currently assigned one. |
| Expected Result | The dialog closes. The page shows "Pending reassignment", naming the nominee and the proposed date/time. "Approve"/"Reject" are still enabled for the outgoing coordinator (they remain the active coordinator). `select * from event.reassignment_proposals where event_id = '<id>'` shows one row with `status = 'PENDING'`. |
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog closed and the page showed "Pending reassignmentProposed to Coordinator Two on 9/20/2026, 3:30:13 PM.". Approve and Reject stayed enabled for the outgoing coordinator (Coordinator One), and one proposal row is PENDING for the nominee. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/E2/evidence/E2-T1.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
