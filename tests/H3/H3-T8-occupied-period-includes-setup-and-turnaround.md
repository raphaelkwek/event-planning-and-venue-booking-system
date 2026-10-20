# H3-T8 — An event's occupied period includes the venue's setup and turnaround time

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T8 |
| Test Scenario | An event's occupied period includes the venue's setup and turnaround time |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup 30 and turnaround 45 minutes (H3-T1).<br>3. A booking of the venue for an event from 10:00 to 12:00 (L1, M1). |
| Test Steps | 1. Open the venue's availability calendar for that day (I1). |
| Test Data | Event 10:00–12:00 · Setup 30 · Turnaround 45 |
| Expected Result | The venue is shown as occupied from 09:30 to 12:45, the customer's own example. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

> **Not executable yet.** No booking (L1, M1) or calendar (I1) exists. The calculation itself is
> unit-tested now in planning-core (`occupiedPeriod`, with this example), and the venue module
> exports it for those stories.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Awaiting I1 (Sprint 2) and L1, M1 (Sprint 3). |
| Executed By | |
| Date of Execution | |
