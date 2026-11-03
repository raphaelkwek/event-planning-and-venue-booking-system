# A1-T3 — Sign in as a role that has no event screens (Venue Staff)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T3 |
| Test Scenario | Sign in as a role that has no event screens (Venue Staff) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173 and enter the email and password.<br>2. Click "Sign in". |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The "Direct API console" screen opens. The header shows `venuestaff@connectsphere.test · Venue Staff`. (The role was shown as the code `VENUE_STAFF` until 2026-09-17.) |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Signed in through the form: the Direct API console opened and the header showed `venuestaff@connectsphere.test · Venue Staff`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A1-T3 Venue Staff, who have no event screens, land on the Direct API console, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
