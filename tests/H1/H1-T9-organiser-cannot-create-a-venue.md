# H1-T9 — An Event Organiser cannot create a venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T9 |
| Test Scenario | An Event Organiser cannot create a venue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open "API console". Send `POST /venue/api/v1/venues` with the standard venue as the body.<br>2. Click "Venues". |
| Test Data | Account: `organiser@connectsphere.test` · Body: the standard venue as JSON |
| Expected Result | The response is `403` with code `ROLE_NOT_AUTHORISED`. "Venues" shows no `Lee Kong Chian Auditorium` and no "New venue" button. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The POST returned 403 ROLE_NOT_AUTHORISED. Venues showed no Lee Kong Chian Auditorium and no "New venue" button. |
| Status | Pass |
| Remarks | Commit: 56eb0b2 · Evidence: tests/H1/evidence/H1-T9.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
