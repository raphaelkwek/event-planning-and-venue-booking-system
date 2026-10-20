# L3-T4 — The reminder lead time must be a whole number of minutes, at least 1

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T4 |
| Test Scenario | The reminder lead time must be a whole number of minutes, at least 1 |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Request a hold as in L3-T1 with Remind me `0`.<br>2. Again with `1.5`.<br>3. Again with `1`. |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` · 0, 1.5 and 1 minute |
| Expected Result | Steps 1 and 2 show "Enter a whole number of minutes, at least 1." under Remind me, and store nothing. Step 3 shows "Hold HLD-… requested." with a reminder of 1 minute before expiry. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 0 and 1.5 each showed "Enter a whole number of minutes, at least 1." and stored nothing (0 holds). 1 showed "Hold HLD-000043 requested." with reminder_lead_minutes 1. |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T4.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |