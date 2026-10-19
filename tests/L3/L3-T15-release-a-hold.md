# L3-T15 — The holding coordinator releases a requested or held hold; it is kept as Released and the period is free again; nobody else can release it

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T15 |
| Test Scenario | The holding coordinator releases a requested or held hold; it is kept as Released and the period is free again; nobody else can release it |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. L3-T5 done (HLD-A Held). L3-T11 step 2 done (HLD-B Requested at `Seminar Room 2-1`). |
| Test Steps | 1. As the coordinator who is **not** assigned, in the API console, `POST /venue/api/v1/holds/<HLD-A id>/release`.<br>2. As the assigned coordinator, click "Release" on HLD-A and confirm.<br>3. Click "Release" on HLD-B and confirm.<br>4. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026, and run "Looking a hold up". |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` |
| Expected Result | Step 1 answers 403 `ROLE_NOT_AUTHORISED`. Steps 2 and 3 show "HLD-… released." and the holds Released, with no further actions. Step 4 shows 14:00–18:00 free, both holds `RELEASED`, HLD-A's slot `RELEASED`; both records are kept. |
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
