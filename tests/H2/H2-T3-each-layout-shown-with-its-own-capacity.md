# H2-T3 — Each layout is shown with its own capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | H2-T3 |
| Test Scenario | Each layout is shown with its own capacity |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "View" on `Lee Kong Chian Auditorium`.<br>2. Look at "Layouts". |
| Test Data | Layouts Theatre 300 · Classroom 120 · Banquet 180 |
| Expected Result | "Layouts" has one row per layout, each with its own capacity: Theatre 300, Classroom 120, Banquet 180. The capacities differ from one another and from nothing being shown. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Layouts" had one row per layout with its own capacity: Theatre 300, Classroom 120, Banquet 180. |
| Status | Pass |
| Remarks | Commit: ca285fa · Evidence: tests/H2/evidence/H2-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-05 |
