# L3-T12 — A held period shows as Held on the availability calendar, labelled with the event reference, and the venue is left out of search for that period

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T12 |
| Test Scenario | A held period shows as Held on the availability calendar, labelled with the event reference, and the venue is left out of search for that period |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. L3-T5 done. |
| Test Steps | 1. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026.<br>2. "Find a venue" for 2 December 2026, 15:00–16:00.<br>3. Repeat step 2 for 2 December 2026, 19:00–20:00. |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` |
| Expected Result | Step 1 shows 14:00–18:00 as "Held", labelled with the event's reference, distinct from Pending and Confirmed. Step 2 doesn't list `Lee Kong Chian Auditorium`. Step 3 lists it. |
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
