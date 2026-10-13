# K1-T11 — A condition that cannot be assessed from the records shows as a warning, not a pass or a failure

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T11 |
| Test Scenario | A condition that cannot be assessed from the records shows as a warning, not a pass or a failure |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-NOLAYOUT`: 100 attendees, no layout recorded, otherwise meeting every requirement.<br>Event `K1-E-NOPERIOD`: no proposed start or end recorded, otherwise meeting every requirement.<br>Event `K1-E-ODDLAYOUT`: layout "Banquet", which `K1 Test Hall` does not offer, otherwise meeting every requirement.<br>Event `K1-E-WARNFAIL`: no layout recorded and needs Simultaneous interpretation. |
| Expected Result | The first three read **Suitable with warnings**, each listing a warning that says which condition could not be assessed and why (no layout, no period, layout not offered). No failing reason is listed. `K1-E-WARNFAIL` reads **Not suitable**, lists the facility reason, and still lists the layout warning separately. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | No layout, no period and a layout the venue does not offer each gave SUITABLE_WITH_WARNINGS with no reasons and one warning whose message says why (records no room layout, records no proposed period, does not offer the Banquet layout). No layout plus a missing facility gave NOT_SUITABLE with the facility reason and the layout warning listed separately. |
| Status | Pass (automated, API level) |
| Remarks | Commit: a5038c9 · Evidence: backend/services/planning-core/tests/venue/api/suitability.test.ts › is Suitable with warnings when the event records no layout or period, not a failure (K1-T11), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38065630198 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-10 |
