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
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
