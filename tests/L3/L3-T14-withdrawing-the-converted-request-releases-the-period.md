# L3-T14 — Withdrawing the request a hold became (L2) releases the held period

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T14 |
| Test Scenario | Withdrawing the request a hold became (L2) releases the held period |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. L3-T13 done. |
| Test Steps | 1. As the assigned coordinator, withdraw the request (L2).<br>2. Open the venue's availability for 2 December 2026.<br>3. Run "Looking a hold up". |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` |
| Expected Result | Step 1 shows "BKR-… withdrawn." Step 2 shows 14:00–18:00 free. Step 3 shows the hold still `CONVERTED` and its slot `RELEASED`. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Withdrawing BKR-000005 showed "BKR-000005 withdrawn."; the calendar shows 14:00–18:00 free; the hold is still CONVERTED and its slot RELEASED. |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T14.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |