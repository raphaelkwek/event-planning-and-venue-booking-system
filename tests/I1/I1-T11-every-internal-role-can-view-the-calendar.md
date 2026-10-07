# I1-T11 — Event Organisers, Venue Staff and Technical Support Staff can view the calendar too

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T11 |
| Test Scenario | Event Organisers, Venue Staff and Technical Support Staff can view the calendar too |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed. Note `<REF-SYMPOSIUM>`. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`. Open the venue's availability and show 7 December 2026 to 7 December 2026, as in I1-T2.<br>2. Sign out. Repeat step 1 as `venuestaff@connectsphere.test`.<br>3. Sign out. Repeat step 1 as `techsupport@connectsphere.test`. |
| Test Data | Accounts: `organiser@connectsphere.test`, `venuestaff@connectsphere.test`, `techsupport@connectsphere.test` |
| Expected Result | Each of the three accounts sees Monday's calendar with `10:00–12:00` marked "Confirmed" and labelled `<REF-SYMPOSIUM>`, and the same free periods as I1-T1. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Each of organiser, venuestaff, techsupport saw Monday with "10:00–12:00 Confirmed EVT-006129" and free periods 08:00–09:30, 12:30–13:45, 16:45–22:00. |
| Status | Pass |
| Remarks | Commit: 69e657d · Evidence: tests/I1/evidence/I1-T11.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
