# C3-T4 — A draft row shows its last-saved time; a submitted row shows its submission time

## Specification

| Item | Content |
|---|---|
| Test Case ID | C3-T4 |
| Test Scenario | A draft row shows its last-saved time; a submitted row shows its submission time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Still a draft` completed.<br>3. FX-SUBMITTED with Event name `Already submitted` completed. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "Still a draft" shows a date and time under "Last saved", and "—" under "Submitted". "Already submitted" shows a date and time under "Submitted". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The draft row showed Last saved 9/20/2026, 3:26:48 PM and Submitted "—"; the submitted row showed Submitted 9/20/2026, 3:26:48 PM. Rows: —Still a draftDraft9/20/2026, 3:26:48 PM——Open draft \| EVT-001723Already submittedSubmitted—9/20/2026, 3:26:48 PMCoordinator OneView |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C3/evidence/C3-T4.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
