# L3-T13 — A Held hold converts into a booking request for the same venue and period without re-checking availability; the hold is Converted and the period stays held under the request

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T13 |
| Test Scenario | A Held hold converts into a booking request for the same venue and period without re-checking availability; the hold is Converted and the period stays held under the request |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. L3-T5 done. |
| Test Steps | 1. As the assigned coordinator, open the event's "Venue requests" and click "Convert to request" on the hold.<br>2. Choose Room layout `Theatre`, leave the rest, and click "Submit request".<br>3. Open the venue's availability for 2 December 2026.<br>4. Run "Looking a hold up". |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` |
| Expected Result | Step 1 opens the request form with the venue and period fixed to the hold's. Step 2 shows "Booking request BKR-… submitted."; the Holds table shows the hold Converted, and the requests table the new Pending request. Step 3 shows 14:00–18:00 once, as Pending. Step 4 shows `CONVERTED`, the slot still `HELD`, its reference now the request's `BKR-…`. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Convert to request opened the form with the venue fixed; submitting showed "Booking request BKR-000004 submitted."; the Holds table shows HLD-000058 Converted and the requests table a Pending request. Lookup: status CONVERTED, slot HELD, slot reference BKR-000004. |
| Status | Pass |
| Remarks | Commit: 01a891e · Evidence: tests/L3/evidence/L3-T13.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |