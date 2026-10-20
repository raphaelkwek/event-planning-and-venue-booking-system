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

## Execution record

| Item | Content |
|---|---|
| Actual Result | Approving BKR-002615 (13:15–14:00) returned 200 APPROVED; its booking is CONFIRMED and occupied from 12:45. The calendar shows 00:00–08:00 Outside operating hours; 09:30–10:00 Setup EVT-011449 · occupied; 10:00–12:00 Confirmed EVT-011449; 12:00–12:45 Turnaround EVT-011449 · occupied; 12:45–13:15 Setup EVT-011450 · occupied; 13:15–14:00 Confirmed EVT-011450; 14:00–14:45 Turnaround EVT-011450 · occupied; 22:00–24:00 Outside operating hours. |
| Status | Pass |
| Remarks | Commit: 0eb3119 · Evidence: tests/H3/evidence/H3-T9.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |
