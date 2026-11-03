# R3-T6 — Boundary: an attendee with no registrations sees an empty state, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T6 |
| Test Scenario | Boundary: an attendee with no registrations sees an empty state, not an error |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. (Attendee One has no registrations after the reset.) |
| Test Steps | 1. Click "My registrations". |
| Test Data | No registrations |
| Expected Result | The page shows `You have no registrations yet.` and a link to "Events". No error is shown. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With no registrations the page showed `You have no registrations yet.` and a link to Events, and no error. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/r-registration.spec.ts › R3-T6 boundary: an attendee with no registrations sees an empty state, not an error, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
