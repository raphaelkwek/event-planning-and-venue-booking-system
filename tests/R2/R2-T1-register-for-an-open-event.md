# R2-T1 — Happy path: an attendee registers for an open event, sees a confirmation, and the registration is stored as Registered with its timestamp

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T1 |
| Test Scenario | Happy path: an attendee registers for an open event, sees a confirmation, and the registration is stored as Registered with its timestamp |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (3 seats). Note its event id.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events", find `R Test Symposium` and click "View event".<br>2. Click "Register".<br>3. In the SQL editor run `select attendee_id, event_id, status, registered_at from registration.registrations where event_id = '<event id>';` |
| Test Data | Account: `attendee@connectsphere.test` / `ConnectSphere-Test-1234!` (user id `00000000-0000-0000-0000-000000000005`) |
| Expected Result | Step 2 shows "You are registered" with the registration's reference (`REG-` and six digits) and a link to "My registrations". Step 3 returns one row: the attendee's user id, the event id, status `REGISTERED` and a `registered_at` within the last minute. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Register returned 201 and the page showed `You are registered` with a `REG-` and six-digit reference and a link to My registrations; a SQL read returned one row with the attendee's id, the event id, status REGISTERED and a registered_at within the last minute. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/r-registration.spec.ts › R2-T1 an attendee registers for an open event, sees a confirmation, and the registration is stored as Registered, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
