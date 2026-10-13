# K1-T12 — Roles other than Event Coordinator cannot check suitability

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T12 |
| Test Scenario | Roles other than Event Coordinator cannot check suitability |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`; open `K1 Test Hall` and look for the Suitability section; then call the check through the API console.<br>2. Repeat as `venuestaff@connectsphere.test`, `techsupport@connectsphere.test` and `attendee@connectsphere.test`. |
| Test Data | Event `K1-E-FIT` · Venue `K1 Test Hall` |
| Expected Result | No role other than Event Coordinator sees the Suitability section. A direct API call as each of them is refused with a message that the role is not authorised, and no assessment is returned. |
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
