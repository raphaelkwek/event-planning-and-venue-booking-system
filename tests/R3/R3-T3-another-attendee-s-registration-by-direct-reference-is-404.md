# R3-T3 — Negative: opening another attendee's registration by its id answers as if it did not exist

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T3 |
| Test Scenario | Negative: opening another attendee's registration by its id answers as if it did not exist |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults, then FX-R-OTHER-ATTENDEE on it. Note the returned registration id.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open the API console at `http://localhost:5173/#/console` (attendees reach it by its address; it is not in their navigation), set Method `GET` and Path `/registration/api/v1/registrations/<that id>`, and click "Send".<br>2. Do the same with a random UUID as the id. |
| Test Data | The other attendee's registration id; a random UUID |
| Expected Result | Both are `404` `REGISTRATION_NOT_FOUND` with the same message, `No registration with that id is yours.`: nothing about the other attendee's registration is returned. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | From the API console, GET /registration/api/v1/registrations/<id> returned 404 REGISTRATION_NOT_FOUND with `No registration with that id is yours.` for both the other attendee's id and a random UUID, with identical messages and nothing about the other registration. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R3-T3 another attendee's registration by its id answers as if it did not exist, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
