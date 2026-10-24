# I6-T5 — Every internal user who can see the calendar sees the flag; an attendee still has no access (I1)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I6-T5 |
| Test Scenario | Every internal user who can see the calendar sees the flag; an attendee still has no access (I1) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-OVERLAP completed. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`, open the venue's availability and show 2 December 2026. Sign out.<br>2. Repeat as `venuestaff@connectsphere.test` and `techsupport@connectsphere.test`.<br>3. Sign in as `attendee@connectsphere.test` and open the calendar's address, `#/venues/<VENUE_ID>/availability`. |
| Test Data | Accounts: `organiser@`, `venuestaff@`, `techsupport@`, `attendee@connectsphere.test` |
| Expected Result | Each of the three internal accounts sees both bookings flagged, naming each other, as in I6-T1. The attendee is not shown the calendar, as in I1-T10. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
