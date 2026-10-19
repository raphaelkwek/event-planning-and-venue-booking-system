# J1-T16 — Boundary: a window starting exactly at opening and ending exactly at closing is kept; one minute either side is not

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T16 |
| Test Scenario | Boundary: a window starting exactly at opening and ending exactly at closing is kept; one minute either side is not |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Set From to 14 December 2026, 08:00 and To to 14 December 2026, 08:30.<br>3. Click “Search”.<br>4. Change the window to 14 December 2026, 07:59–08:30 and click “Search”.<br>5. Change the window to 14 December 2026, 20:00–22:00 and click “Search”.<br>6. Change the window to 14 December 2026, 21:30–22:01 and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium, FX Seminar Room and FX Lecture Hall open 08:00–22:00 on Monday. FX Lecture Hall's block starts at 09:00 |
| Expected Result | 08:00–08:30: FX Auditorium, FX Seminar Room and FX Lecture Hall. 07:59–08:30: no venue. 20:00–22:00: FX Auditorium, FX Seminar Room and FX Lecture Hall (FX Late Studio closes at 20:00). 21:30–22:01: no venue. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 14 Dec 08:00-08:30 returned Auditorium, Lecture Hall and Seminar Room; 07:59-08:30 returned no venue; 20:00-22:00 returned Auditorium, Lecture Hall and Seminar Room (Late Studio closes at 20:00); 21:30-22:01 returned no venue. The empty-result message for this input was not asserted in that test; the message is asserted generically by the J1-T20 test. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › keeps a window that starts exactly at opening and ends exactly at closing, and drops one a minute outside (J1-T16) ; backend/services/planning-core/tests/venue/api/venueSearch.test.ts › answers a search that matches nothing with 200, an empty list and a message restating the filters (J1-T20) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
