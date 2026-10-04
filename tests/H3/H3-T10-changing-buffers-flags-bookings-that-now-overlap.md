# H3-T10 — Changing a venue's buffers flags the bookings that now overlap, removing none

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T10 |
| Test Scenario | Changing a venue's buffers flags the bookings that now overlap, removing none |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed, with setup and turnaround 0.<br>3. Two confirmed bookings of the venue on one day: 10:00–12:00 and 12:15–14:00 (M1). |
| Test Steps | 1. As Venue Staff, set the turnaround time to `30` minutes and save.<br>2. Open both bookings. |
| Test Data | Turnaround `30` |
| Expected Result | Both bookings are flagged Requires Reconfirmation, each naming the other as the overlapping reference, and each coordinator is notified. Neither booking is removed, released or moved. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

> **Not executable yet.** Needs bookings (EN-02.1, L1, M1; Sprint 3). Nothing can overlap until then,
> so this rule is built with them.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Awaiting EN-02.1 and L1, M1 (Sprint 3). |
| Executed By | |
| Date of Execution | |
