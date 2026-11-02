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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Covered by backend/services/registration/tests/api/r2Cards.test.ts › R2-T2 takes its places from the layout capacity: two left of three, and a second registration is accepted (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
