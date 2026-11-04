# R6-T2 — Negative: joining the waitlist while places remain is refused, and stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T2 |
| Test Scenario | Negative: joining the waitlist while places remain is refused, and stores nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults (3 seats).<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Ask to join the waitlist through the API console: `POST /registration/api/v1/events/<EVENT_ID>/waitlist`. |
| Test Data | 3 seats, all free |
| Expected Result | 409 `WAITLIST_PLACES_AVAILABLE`: places remain, so register instead. No waitlist entry exists. The event's page offers Register, not the waitlist. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | From the API console, POST /registration/api/v1/events/<EVENT_ID>/waitlist answered 409 `WAITLIST_PLACES_AVAILABLE` with `EVT-R… “…” still has 3 places remaining, so register instead of joining the waitlist.`; no waitlist entry was stored, and the event's page offered Register and no Join the waitlist. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R6-T2 joining while places remain is refused; the event offers Register, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
