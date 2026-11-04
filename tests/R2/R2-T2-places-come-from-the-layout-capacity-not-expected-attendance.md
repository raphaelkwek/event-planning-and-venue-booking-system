# R2-T2 — Places are the booked layout's capacity: expected attendance does not cap registration, and there is no separate registration capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T2 |
| Test Scenario | Places are the booked layout's capacity: expected attendance does not cap registration, and there is no separate registration capacity |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with `<SEATS>` = 3 (the event's request said 1 expected attendee: expected attendance never reaches the registration service).<br>3. FX-R-TAKEN with `<N>` = 1.<br>4. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open `R Test Symposium` from "Events".<br>2. Note places remaining.<br>3. Click "Register". |
| Test Data | Layout capacity 3; 1 place already taken; expected attendance 1 |
| Expected Result | Step 2 shows `2 places remaining` (3 − 1). Step 3 succeeds although one attendee is already registered and the expected attendance was 1. Nowhere on the organiser's or the attendee's screens is a registration capacity entered. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With 3 seats and 1 taken the page showed `2 places remaining` and Register succeeded (201). No registration-capacity input or label appeared on the attendee's screens, the organiser's New request form or the Registration settings screen. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R2-T2 places come from the layout capacity, not the expected attendance, and no registration capacity is entered anywhere, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
