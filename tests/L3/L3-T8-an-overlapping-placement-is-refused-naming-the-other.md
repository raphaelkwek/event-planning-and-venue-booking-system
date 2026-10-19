# L3-T8 — Placing a hold whose period overlaps a held period is refused, naming the other hold's reference and period; the hold stays Requested

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T8 |
| Test Scenario | Placing a hold whose period overlaps a held period is refused, naming the other hold's reference and period; the hold stays Requested |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. L3-T5 done (HLD-A Held, 2 December 2026 14:00–18:00).<br>4. FX-HOLD-RIVAL done. |
| Test Steps | 1. As `coordinator2@connectsphere.test`, request a hold for the rival event at `Lee Kong Chian Auditorium`, 2 December 2026, 16:00–20:00.<br>2. As `venuestaff@`, place it, as in L3-T5. |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · 16:00–20:00 overlaps 14:00–18:00 |
| Expected Result | Step 2 shows "This period overlaps HLD-A (Wednesday 2 December 2026, 14:00–18:00) at Lee Kong Chian Auditorium. A held or booked period can't be taken by another event." (code `VENUE_SLOT_CONFLICT`). The rival's hold stays Requested in the list, and the calendar still shows only HLD-A's event. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
