# K1-T10 — The check is advisory: it creates, changes and blocks no booking

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T10 |
| Test Scenario | The check is advisory: it creates, changes and blocks no booking |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability for 7 to 13 Dec 2026 and note it.<br>2. Run the check for `K1-E-ALLWRONG` (Not suitable) and for `K1-E-FIT` (Suitable).<br>3. Reopen the availability for the same dates.<br>4. Open each event. |
| Test Data | Event `K1-E-ALLWRONG`, `K1-E-FIT` · Venue `K1 Test Hall` |
| Expected Result | The availability is the same before and after: no pending request, hold or booking appeared. Neither event changed status or any field. Nothing on the screen offers to block or submit a booking. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
