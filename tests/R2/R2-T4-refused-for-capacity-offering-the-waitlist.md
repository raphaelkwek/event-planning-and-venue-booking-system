# R2-T4 — Negative: registering for a full event is refused naming capacity, offers the waitlist, stores no record and leaves places unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T4 |
| Test Scenario | Negative: registering for a full event is refused naming capacity, offers the waitlist, stores no record and leaves places unchanged |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (3 seats), then FX-R-TAKEN with `<N>` = 3.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. The event page shows `Full` and no Register button (R1-T6). To try anyway: Open the API console at `http://localhost:5173/#/console` (attendees reach it by its address; it is not in their navigation), set Method `POST`, Path `/registration/api/v1/registrations` and Body `{ "eventId": "<event id>" }`, and click "Send".<br>2. Count the attendee's registrations for the event in the SQL editor. |
| Test Data | 3 seats, all taken |
| Expected Result | The response is `409` with code `REGISTRATION_FULL`, a message naming capacity (`… has no places remaining …`) and `details.waitlistOffered: true`. The attendee has no registration for the event, and the event still shows `Full` (0 places). |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The page showed Full and no Register button. From the API console, POST /registration/api/v1/registrations returned 409 REGISTRATION_FULL, a message containing `has no places remaining` and naming the event, and details.waitlistOffered true; SQL found no registration for the attendee, and the card still showed Full. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R2-T4 registering for a full event is refused naming capacity and offering the waitlist, and stores nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
