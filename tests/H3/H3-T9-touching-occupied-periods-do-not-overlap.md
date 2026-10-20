# H3-T9 — Occupied periods that merely touch do not overlap

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T9 |
| Test Scenario | Occupied periods that merely touch do not overlap |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup 30 and turnaround 45 minutes.<br>3. A confirmed booking from 10:00 to 12:00, so occupied 09:30–12:45 (M1). |
| Test Steps | 1. Request the same venue for an event from 13:15 to 14:00, occupied 12:45–14:45 (L1).<br>2. Approve it (M1). |
| Test Data | Second event 13:15–14:00 |
| Expected Result | The approval succeeds: the two occupied periods touch at 12:45 and do not overlap. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

> **Not executable yet.** Needs L1 and M1 (Sprint 3). The overlap rule is unit-tested now
> (`periodsOverlap`).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Awaiting L1, M1 (Sprint 3). |
| Executed By | |
| Date of Execution | |
