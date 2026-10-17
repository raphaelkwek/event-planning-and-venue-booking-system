# L1-T14 — A request for an inactive venue, a venue that doesn't exist, or a layout the venue doesn't have is refused and stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T14 |
| Test Scenario | A request for an inactive venue, a venue that doesn't exist, or a layout the venue doesn't have is refused and stores nothing |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed. `Old Lecture Theatre` is inactive.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the API console and send L1-T10's body (no `replacesBookingId`) with `venueId` of `Old Lecture Theatre`.<br>2. Send it with `venueId` `00000000-0000-0000-0000-00000000dead`.<br>3. Send it for `Lee Kong Chian Auditorium` with `layout` `Boardroom`. |
| Test Data | Account: the assigned coordinator · `Lee Kong Chian Auditorium`'s layouts are Theatre, Classroom and Banquet |
| Expected Result | Step 1 returns `422` saying the venue is inactive. Step 2 returns `404` `VENUE_NOT_FOUND`. Step 3 returns `400` naming `layout`, saying the venue has no Boardroom layout. The event has no booking requests afterwards. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Old Lecture Theatre: 422 VENUE_INACTIVE, "Old Lecture Theatre is inactive, so it can't be requested.". Unknown venue: 404 VENUE_NOT_FOUND. Boardroom: 400, naming layout: "Lee Kong Chian Auditorium has no Boardroom layout.". The event had no booking requests. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T14.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
