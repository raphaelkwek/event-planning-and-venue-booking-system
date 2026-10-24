# I3-T5 — The owning organiser is notified when a replacement booking is approved (L5, M1)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T5 |
| Test Scenario | The owning organiser is notified when a replacement booking is approved (L5, M1) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. I3-T1 completed: the event returned to Planning by a block over its `Lee Kong Chian Auditorium` booking. |
| Test Steps | 1. As the coordinator, find a replacement for the booking (L5) and request `Mochtar Riady Hall`, Theatre, 150, 2 December 2026 14:00–18:00.<br>2. As Mochtar Riady Hall's Venue Staff, approve it (M1).<br>3. Sign in as `organiser@connectsphere.test` and open Notifications. |
| Test Data | Replacement at `Mochtar Riady Hall` |
| Expected Result | The organiser has a notification that the replacement request was approved and the booking is confirmed (M1), and none from when the block was recorded. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

> Attendees are notified with the organiser (W9-51), but registration (R2) isn't built, so this case checks the organiser only.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
