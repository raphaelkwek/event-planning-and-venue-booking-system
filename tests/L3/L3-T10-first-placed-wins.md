# L3-T10 — When two events request the same period, the hold placed first keeps it, whichever was requested first

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T10 |
| Test Scenario | When two events request the same period, the hold placed first keeps it, whichever was requested first |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. FX-HOLD-RIVAL done. |
| Test Steps | 1. As the assigned coordinator, request a hold, as in L3-T1 (HLD-A).<br>2. As `coordinator2@`, request the same venue and period for the rival event (HLD-B).<br>3. As `venuestaff@`, place HLD-B, then place HLD-A. |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · HLD-A requested first, HLD-B placed first |
| Expected Result | HLD-B is Held. Placing HLD-A is refused, naming HLD-B and 14:00–18:00, and HLD-A stays Requested. No screen offers a way to displace HLD-B. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HLD-000053 (placed first) is HELD. Placing HLD-000052 was refused: "This period overlaps HLD-000053 (Wednesday 2 December 2026, 14:00–18:00) at Lee Kong Chian Auditorium."; HLD-000052 stayed REQUESTED. No screen offers a way to displace the held period. |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T10.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — · The rival hold was requested through the API the form calls |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |