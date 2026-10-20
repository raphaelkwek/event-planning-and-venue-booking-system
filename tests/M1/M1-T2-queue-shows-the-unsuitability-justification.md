# M1-T2 — The queue shows any unsuitability justification recorded with the request (K2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T2 |
| Test Scenario | The queue shows any unsuitability justification recorded with the request (K2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested a venue K1 finds Not suitable, recording the justification `The only hall free that week` (K2).<br>4. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests". |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The request's row shows the justification and the failing conditions as evaluated when the request was made. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

> **Waits for K2.** K2 records the justification and the failing conditions with the request, and
> isn't built yet. Until it is, no request carries one and this case can't be set up. It stays Not
> Executed, owned by K2 (Sprint 3); the queue's other columns are M1-T1.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
