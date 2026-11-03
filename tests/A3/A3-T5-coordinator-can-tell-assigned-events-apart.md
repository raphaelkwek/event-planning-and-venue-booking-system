# A3-T5 — A coordinator's lists show only their own events, each marked as theirs

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T5 |
| Test Scenario | A coordinator's lists show only their own events, each marked as theirs |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser@connectsphere.test`: FX-SUBMITTED with Event name `First assigned request`, then FX-ASSIGNED to Coordinator One.<br>3. As `organiser@connectsphere.test`: FX-SUBMITTED with Event name `Second assigned request`, then FX-ASSIGNED to Coordinator Two. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue".<br>3. Click "All events". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | In steps 2 and 3, "First assigned request" is listed and shows "You" under "Assigned to"; "Second assigned request" is not listed. "All events" offers no "Every event" or "Assigned to me" button. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** Every event a coordinator's lists show is their own, so the screens mark each as theirs and offer no "Assigned to me" filter. The pre-conditions no longer use `EVENT_COORDINATOR_POOL`, which E3 retired.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-02; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
