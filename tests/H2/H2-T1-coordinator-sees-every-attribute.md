# H2-T1 — An Event Coordinator sees every catalogue attribute of a venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | H2-T1 |
| Test Scenario | An Event Coordinator sees every catalogue attribute of a venue |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-VENUE completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "Venues".<br>2. Click "View" on `Lee Kong Chian Auditorium`. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · The standard venue |
| Expected Result | The venue's page shows, read from the catalogue: name `Lee Kong Chian Auditorium`; building `School of Computing, Level 1`; maximum capacity 300; status Active; the three layouts with their capacities; the three facilities; the three accessibility features; opening hours for each day. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

> **Changed 5 Oct 2026.** This case first also expected the setup and turnaround times, which H3
> (CR-01) adds. H3 carries over to Sprint 3 because its booking cases cannot run yet, so H2 ships
> without them; H3 adds the two times to this page and to this case when it lands.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The page showed Lee Kong Chian Auditorium; summary "SummaryBuilding / locationSchool of Computing, Level 1Maximum capacity300StatusActive"; layouts Theatre 300, Classroom 120, Banquet 180; facilities Projector, Wireless microphones, Stage lighting; accessibility features Step-free access, Hearing loop, Accessible toilet; and hours for all seven days. |
| Status | Pass |
| Remarks | Commit: ca285fa · Evidence: tests/H2/evidence/H2-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-05 |
