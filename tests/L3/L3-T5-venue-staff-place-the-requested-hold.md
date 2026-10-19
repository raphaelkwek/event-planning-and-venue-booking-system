# L3-T5 — Venue Staff of the venue see the requested hold and place it with an expiry; it becomes Held, recording who placed it and when

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T5 |
| Test Scenario | Venue Staff of the venue see the requested hold and place it with an expiry; it becomes Held, recording who placed it and when |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. L3-T1 step 1 done. |
| Test Steps | 1. Sign in as `venuestaff@connectsphere.test` and open "Hold requests".<br>2. As `venuestaff@connectsphere.test`: "Hold requests" → the hold's row → Expires 1 December 2026, 18:00 → "Place hold".<br>3. Sign in as the assigned coordinator and open the event's "Venue requests".<br>4. Run "Looking a hold up". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · Expiry 1 December 2026, 18:00 |
| Expected Result | Step 1 lists the hold with the event reference, `Lee Kong Chian Auditorium`, 2 December 2026 14:00–18:00, the requesting coordinator and the reminder. Step 2 shows "HLD-… placed. It expires on Tuesday 1 December 2026, 18:00." and the hold leaves the list. Step 3 shows the hold Held, expiring Tuesday 1 December 2026, 18:00. Step 4 shows `ACTIVE`, `placed_by` Venue Staff One's id, `placed_at` within the last minute, and a slot with the hold's reference, status `HELD`. |
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
