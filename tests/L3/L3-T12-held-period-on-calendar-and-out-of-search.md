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
| Actual Result | The availability calendar for 2 December 2026 shows the period as "Held" labelled EVT-000056. "Find a venue" for 15:00–16:00 did not list Lee Kong Chian Auditorium (200); for 19:00–20:00 it did (200). |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T12.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — · Search results read from the endpoint the Find a venue screen calls |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |