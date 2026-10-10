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
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
