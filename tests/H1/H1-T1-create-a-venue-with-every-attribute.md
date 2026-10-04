# H1-T1 — Venue Staff create a venue with every catalogue attribute

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T1 |
| Test Scenario | Venue Staff create a venue with every catalogue attribute |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues".<br>2. Click "New venue".<br>3. Enter the standard venue (`tests/README.md`).<br>4. Click "Save venue". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · The standard venue |
| Expected Result | "Venue saved." is shown, and the form shows every value as entered: name `Lee Kong Chian Auditorium`, building `School of Computing, Level 1`, maximum capacity 300, the three layouts each with its own capacity (Theatre 300, Classroom 120, Banquet 180), the three facilities, the three accessibility features, and the opening hours for each day (Monday to Friday 08:00–22:00, Saturday 09:00–18:00, Sunday closed). "Venues" lists the venue as Active. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Venue saved." was shown and the form showed every value as entered: Theatre 300, Classroom 120, Banquet 180; 3 facilities; 3 accessibility features; Monday 08:00–22:00, Tuesday 08:00–22:00, Wednesday 08:00–22:00, Thursday 08:00–22:00, Friday 08:00–22:00, Saturday 09:00–18:00, Sunday closed. Venues listed it as Active. |
| Status | Pass |
| Remarks | Commit: 56eb0b2 · Evidence: tests/H1/evidence/H1-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
