# T2-T5 — The organiser reads a notification of the rejection, including the reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T5 |
| Test Scenario | The organiser reads a notification of the rejection, including the reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-REJECTED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the reference, says the request was rejected, and includes the reason. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

> **Split out of D5-T7 on 2026-09-20.** D5 owns the trigger (D5-T7 checks the emitted
> `event.rejected` message and that it carries the reason); T2 owns the notification record, the read
> model and the screen this case reads. Not Executed until T2 ships in Sprint 2 — see
> `tests/T2/README.md`.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The organiser's list showed: "Your event request EVT-004524 “Annual Research Symposium” has been rejected. Reason: No suitable venue is available. 10/4/2026, 4:40:29 PM UNREAD Open Mark as read". |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
