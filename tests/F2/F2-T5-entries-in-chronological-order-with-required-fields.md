# F2-T5 — History entries are chronological and show previous status, new status, role and time

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T5 |
| Test Scenario | History entries are chronological and show previous status, new status, role and time |
| Pre-conditions | 1. FX-REJECTED completed.<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the rejected request.<br>2. Read every row of "Status history". |
| Test Data | Event: FX-REJECTED (Draft, Submitted, Under Review, Rejected) |
| Expected Result | The rows run oldest first: Draft to Submitted, Submitted to Under Review, Under Review to Rejected. Every row shows a From status, a To status, the acting user's role and a date and time; each row's From equals the To of the row above it, and no time is earlier than the row above. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
