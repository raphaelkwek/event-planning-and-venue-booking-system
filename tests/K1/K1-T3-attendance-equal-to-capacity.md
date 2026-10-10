# K1-T3 — Boundary: expected attendance exactly equal to the layout's capacity is not a failure

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T3 |
| Test Scenario | Boundary: expected attendance exactly equal to the layout's capacity is not a failure |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-EXACT`: 120 attendees, Theatre layout (capacity 120), otherwise meeting every requirement.<br>Then repeat for `K1-E-ONEOVER`: 121 attendees, Theatre layout. |
| Expected Result | `K1-E-EXACT` reads **Suitable** with no reasons. `K1-E-ONEOVER` reads **Not suitable** with one reason: expected attendance 121 against layout capacity 120. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | At 120 attendees the route answered SUITABLE. At 121 it answered NOT_SUITABLE with exactly one reason, required 121 and available 120. |
| Status | Pass (automated, API level) |
| Remarks | Commit: a5038c9 · Evidence: backend/services/planning-core/tests/venue/api/suitability.test.ts › treats attendance equal to capacity as suitable and one over as not (K1-T3), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38065630198 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-10 |
