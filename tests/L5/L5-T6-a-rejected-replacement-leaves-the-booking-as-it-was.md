# L5-T6 — If the replacement request is rejected, the disrupted booking stays as it was, still flagged, and another replacement can be requested

## Specification

| Item | Content |
|---|---|
| Test Case ID | L5-T6 |
| Test Scenario | If the replacement request is rejected, the disrupted booking stays as it was, still flagged, and another replacement can be requested |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-L5 completed. Note the disrupted booking's id.<br>3. The L5 replacement statement run (replacement at `Seminar Room 2-1`). |
| Test Steps | 1. As `venuestaff@connectsphere.test`, reject the replacement in "Booking requests" with reason `Not available`.<br>2. Read the disrupted booking's `status`, `requires_reconfirmation` and `release_reason`.<br>3. As the assigned coordinator, open the event's "Venue requests" and click "Find a replacement" on the booking again, then "Request this venue" on `Mochtar Riady Hall`, choose Room layout Theatre, and "Submit request". |
| Test Data | Accounts: `venuestaff@connectsphere.test`, then the assigned coordinator |
| Expected Result | The booking is still `CONFIRMED`, flagged, with no release reason, and still offers "Find a replacement". The second replacement request is accepted, Pending, linked to the same booking. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After BKR-001364 was rejected the booking was still CONFIRMED, flagged, with no release reason, and offered "Find a replacement". A second replacement, BKR-001365, was accepted, Pending, linked to the same booking. |
| Status | Pass |
| Remarks | Commit: a97986f · Evidence: tests/L5/evidence/L5-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
