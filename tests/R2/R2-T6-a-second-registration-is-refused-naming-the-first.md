# R2-T6 — Negative: registering again for the same event is refused naming the existing registration, and no second record is created

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T6 |
| Test Scenario | Negative: registering again for the same event is refused naming the existing registration, and no second record is created |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (3 seats).<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`.<br>4. R2-T1's steps 1 and 2 done. Note the reference shown. |
| Test Steps | 1. Reload the event page and click "Register" again (or send the request from R2-T4 step 1).<br>2. Count the attendee's registrations for the event. |
| Test Data | The reference noted in pre-condition 4 |
| Expected Result | Registration is refused: the page shows the server's message `You are already registered for … (registration REG-…)`, naming the noted reference; the response is `409` `REGISTRATION_DUPLICATE`. There is still exactly one registration. Places remaining is unchanged at `2 places remaining`. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r2Cards.test.ts › R2-T6 refuses a second registration naming the first, with no second record and places unchanged (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
