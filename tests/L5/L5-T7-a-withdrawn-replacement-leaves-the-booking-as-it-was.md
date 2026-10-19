# L5-T7 — If the replacement request is withdrawn, the disrupted booking stays as it was, still flagged, and another replacement can be requested

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T7 |
| Test Scenario | If the replacement request is withdrawn, the disrupted booking stays as it was, still flagged, and another replacement can be requested |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-L5 completed. Note the disrupted booking's id.<br>3. The L5 replacement statement run (replacement at `Seminar Room 2-1`).<br>4. Signed in as the assigned coordinator, on the event's "Venue requests". |
| Test Steps | 1. Click "Withdraw" on the replacement request, then "Withdraw request".<br>2. Read the disrupted booking's `status`, `requires_reconfirmation` and `release_reason`.<br>3. Click "Find a replacement" on the booking again. |
| Test Data | Account: the assigned coordinator |
| Expected Result | The replacement is Withdrawn. The booking is still `CONFIRMED`, flagged, with no release reason, and "Find a replacement" opens the replacement search again. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | BKR-001367 was withdrawn. The booking was still CONFIRMED, flagged, with no release reason, and "Find a replacement" opened the replacement search again. |
| Status | Pass |
| Remarks | Commit: a97986f · Evidence: tests/L5/evidence/L5-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
