# L3-T9 — With setup and turnaround time (H3), a placement whose occupied period overlaps is refused, and occupied periods that only touch are both placed

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T9 |
| Test Scenario | With setup and turnaround time (H3), a placement whose occupied period overlaps is refused, and occupied periods that only touch are both placed |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. As `venuestaff@`, set `Lee Kong Chian Auditorium`'s setup time to 30 and turnaround time to 45 minutes (H3).<br>4. L3-T5 done (HLD-A, 14:00–18:00, occupying 13:30–18:45).<br>5. FX-HOLD-RIVAL done. |
| Test Steps | 1. As `coordinator2@`, request a hold for the rival event, 2 December 2026, 19:00–21:00 (occupying 18:30–21:45), and as `venuestaff@` place it.<br>2. As `coordinator2@`, release it, then request 19:15–21:00 (occupying 18:45–21:45) and as `venuestaff@` place it. |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · Setup 30, turnaround 45 |
| Expected Result | Step 1 is refused, naming HLD-A and 14:00–18:00: 18:30 is before HLD-A's turnaround ends at 18:45. Step 2 is placed: the two occupied periods only touch at 18:45. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With setup 30 and turnaround 45, the 19:00–21:00 hold (occupying 18:30–21:45) was refused: "This period overlaps HLD-000049 (Wednesday 2 December 2026, 14:00–18:00) at Lee Kong Chian Auditorium.". After releasing it, the 19:15–21:00 hold (occupying 18:45–21:45) was placed: "HLD-000051 placed.", slot HELD. |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T9.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — · Setup and turnaround set directly in the venue row (H3's columns); rival holds requested and released through the API |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |