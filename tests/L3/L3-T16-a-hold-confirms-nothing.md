# L3-T16 — A hold creates no confirmed booking and leaves the event's status unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T16 |
| Test Scenario | A hold creates no confirmed booking and leaves the event's status unchanged |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. FX-HOLD-STATUS with `'PLANNING'`.<br>4. L3-T5 done. |
| Test Steps | 1. Open the event and read its status.<br>2. Open the venue's availability for 2 December 2026. |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` |
| Expected Result | Step 1 shows the event still Planning. Step 2 shows 14:00–18:00 as Held, not Confirmed. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The event is still PLANNING; the calendar shows 14:00–18:00 as Held, not Confirmed. |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T16.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — · Event status set with FX-HOLD-STATUS SQL |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |