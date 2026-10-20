# L3-T11 — An event can't have a second requested or held hold at the same venue, but can hold another venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T11 |
| Test Scenario | An event can't have a second requested or held hold at the same venue, but can hold another venue |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. L3-T1 step 1 done (HLD-A requested at `Lee Kong Chian Auditorium`). |
| Test Steps | 1. As the assigned coordinator, request another hold at `Lee Kong Chian Auditorium`, 3 December 2026, 10:00–12:00.<br>2. Request a hold at `Seminar Room 2-1`, 2 December 2026, 14:00–18:00. |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` |
| Expected Result | Step 1 is refused: "This event already has hold HLD-A at Lee Kong Chian Auditorium. Release it, or convert it into a booking request, before holding the venue again." (`HOLD_DUPLICATE`), and nothing is stored. Step 2 shows a second hold, Requested, at `Seminar Room 2-1`. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 1 was refused: "This event already has hold HLD-000054 at Lee Kong Chian Auditorium. Release it, or convert it into a booking request, before holding the venue again." (1 hold stored). Step 2 showed "Hold HLD-000056 requested." at Seminar Room 2-1 (2 holds). |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T11.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |