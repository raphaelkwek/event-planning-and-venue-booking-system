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
| Actual Result | After a reload, Register returned 409 REGISTRATION_DUPLICATE and the page showed `You are already registered for … (registration REG-…)` naming the first reference; SQL found exactly one registration, and the page still read `2 places remaining`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R2-T6 a second registration is refused naming the first, stores no second record, and leaves the places unchanged, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
