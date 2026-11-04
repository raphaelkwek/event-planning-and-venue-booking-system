# R1-T1 — An event that is Confirmed, with registration enabled and still open, is listed with its name, description, date, times, venue, location and places remaining

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T1 |
| Test Scenario | An event that is Confirmed, with registration enabled and still open, is listed with its name, description, date, times, venue, location and places remaining |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (Confirmed, registration open, one venue, 3 seats). Note its reference.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events" in the navigation.<br>2. Find the card for `R Test Symposium`.<br>3. Click "View event". |
| Test Data | FX-R-EVENT defaults: name `R Test Symposium`, description `A one-day symposium for the school of computing.`, 16 December 2026 14:00–18:00 (Singapore time), venue `Lee Kong Chian Auditorium`, location `School of Computing, Level 1`, 3 seats |
| Expected Result | The card shows `R Test Symposium`, `A one-day symposium for the school of computing.`, `Wednesday 16 December 2026, 14:00–18:00`, `Lee Kong Chian Auditorium — School of Computing, Level 1` and `3 places remaining`. The event page shows the same values and a "Register" button. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The attendee's Events list showed the card for the test symposium with its description, `Wednesday 16 December 2026, 14:00–18:00`, `Lee Kong Chian Auditorium — School of Computing, Level 1` and `3 places remaining`; the event page showed the same values and a Register button. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R1-T1 an open event is listed with its published details, and its page shows the same with Register, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
