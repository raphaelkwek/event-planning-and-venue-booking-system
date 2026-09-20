# D5-T6 — The reason is shown to the owning organiser, and a different organiser cannot see the request

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T6 |
| Test Scenario | The reason is shown to the owning organiser, and a different organiser cannot see the request |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-REJECTED completed; note the request id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`. Click "My requests", then "View" on the request.<br>2. Sign out, sign in as `organiser2@connectsphere.test`, and go to http://localhost:5173/#/requests/<id>. |
| Test Data | Accounts: `organiser@connectsphere.test`, `organiser2@connectsphere.test` — both `ConnectSphere-Test-1234!` · id: from the pre-condition |
| Expected Result | In step 1 "This request was rejected" shows the reason "No suitable venue is available.". In step 2 a refusal titled `EVENT_NOT_FOUND` is shown, and the reason appears nowhere. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The owner saw "This request was rejectedNo suitable venue is available.Decided 9/20/2026, 3:30:03 PM. A rejected request cannot be edited or resubmitted.". The other organiser was refused with "EVENT_NOT_FOUNDNo event with that reference is available to you.HTTP 404 · correlation 23cd4f1e-83ea-463c-81df-75733a8cabc5", and the reason appeared nowhere on their screen. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D5/evidence/D5-T6.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
