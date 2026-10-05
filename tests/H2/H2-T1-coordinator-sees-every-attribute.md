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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
