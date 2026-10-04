# H1-T13 — Marking a venue inactive keeps its record and history

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T13 |
| Test Scenario | Marking a venue inactive keeps its record and history |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; note the venue's id. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "Edit" on `Lee Kong Chian Auditorium`.<br>2. Untick "Active".<br>3. Click "Save venue".<br>4. Click "Venues".<br>5. In the SQL editor run: `select action, changes from venue.venue_history where venue_id = '<id>' order by occurred_at;` |
| Test Data | Active: unticked |
| Expected Result | "Venue saved." is shown. "Venues" still lists the venue, now with status Inactive, and every field is retained. The history has the `CREATED` row and an `UPDATED` row whose `changes` records `isActive` from true to false. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

> **Split on writing.** H1 also says an inactive venue drops out of venue search results for future
> dates (J1, J2) and stays visible on the availability calendar with its bookings (I1). Those
> screens don't exist yet, so those halves belong to J1, J2 and I1's own cases. This case checks
> what H1 owns: the flag, and that nothing is lost.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
