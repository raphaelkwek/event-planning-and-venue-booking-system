# R4-T3 — Negative: an attendee cannot withdraw someone else's registration; it is answered as not found and nothing changes

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T3 |
| Test Scenario | Negative: an attendee cannot withdraw someone else's registration; it is answered as not found and nothing changes |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults, then FX-R-OTHER-ATTENDEE on it. Note the registration id.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open the API console at `http://localhost:5173/#/console` (attendees reach it by its address; it is not in their navigation), set Method `POST` and Path `/registration/api/v1/registrations/<that id>/withdrawal`, and click "Send".<br>2. Check the registration's status in the SQL editor. |
| Test Data | The other attendee's registration id |
| Expected Result | `404` `REGISTRATION_NOT_FOUND`, `No registration with that id is yours.`. The other attendee's registration is still `REGISTERED` and places remaining is unchanged. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | From the API console, POST /registration/api/v1/registrations/<id>/withdrawal on the other attendee's registration returned 404 REGISTRATION_NOT_FOUND with `No registration with that id is yours.`; that registration was still REGISTERED with no withdrawal time, and places remaining was unchanged. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R4-T3 another attendee's registration cannot be withdrawn; it is answered as not found, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
