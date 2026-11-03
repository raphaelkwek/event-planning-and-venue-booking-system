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
| Actual Result | Organiser, Venue Staff and Technical Support saw no "Check suitability" and were redirected from its route; their API calls and the attendee's got 403 ROLE_NOT_AUTHORISED with no assessment. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/h-venues.spec.ts › K1-T12 roles other than Event Coordinator cannot check suitability, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
