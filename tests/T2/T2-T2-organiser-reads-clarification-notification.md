# T2-T2 — The organiser reads a notification that clarification is required

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T2 |
| Test Scenario | The organiser reads a notification that clarification is required |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the reference and says clarification is required. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

> **Split out of D2-T7 on 2026-09-20.** D2 owns the trigger (D2-T7 checks the emitted
> `event.clarification-requested` message); T2 owns the notification record, the read model and the
> screen this case reads. Not Executed until T2 ships in Sprint 2 — see `tests/T2/README.md`.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The organiser's list showed: "Clarification is required on your event request EVT-004521 “Annual Research Symposium”. 10/4/2026, 4:40:17 PM UNREAD Open Mark as read". |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
