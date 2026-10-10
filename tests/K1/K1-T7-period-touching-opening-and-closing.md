# K1-T7 — Boundary: a period starting exactly at opening and ending exactly at closing is within operating hours

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T7 |
| Test Scenario | Boundary: a period starting exactly at opening and ending exactly at closing is within operating hours |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-EDGES`: Saturday 12 Dec 2026 09:00–18:00 (Saturday hours 09:00–18:00), otherwise meeting every requirement.<br>Event `K1-E-ONEMIN`: Saturday 12 Dec 2026 08:59–18:00.<br>Event `K1-E-ONEMINLATE`: Saturday 12 Dec 2026 09:00–18:01. |
| Expected Result | `K1-E-EDGES` reads **Suitable**. `K1-E-ONEMIN` and `K1-E-ONEMINLATE` each read **Not suitable** with one operating-hours reason. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Saturday 09:00–18:00 gave SUITABLE with no reasons. 08:59–18:00 and 09:00–18:01 each gave NOT_SUITABLE with exactly one OPERATING_HOURS reason against Saturday 09:00–18:00. |
| Status | Pass (automated, API level) |
| Remarks | Commit: a5038c9 · Evidence: backend/services/planning-core/tests/venue/api/suitability.test.ts › accepts a period that touches opening and closing time, and refuses one minute outside (K1-T7), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38065630198 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-10 |
