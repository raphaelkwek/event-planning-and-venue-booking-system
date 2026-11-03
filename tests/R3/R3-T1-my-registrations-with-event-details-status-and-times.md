# R3-T1 — Happy path: My registrations lists each of my registrations with the event name, date, time, venue location, status and registration timestamp

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T1 |
| Test Scenario | Happy path: My registrations lists each of my registrations with the event name, date, time, venue location, status and registration timestamp |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run twice: `R Test Symposium` and `R Second Talk` (`<SEATS>` = 3 each).<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. Register for both (R2-T1 steps 1–2), then withdraw from `R Second Talk` (R4-T1). |
| Test Steps | 1. Click "My registrations". |
| Test Data | Two registrations: one Registered, one Withdrawn |
| Expected Result | Both are listed. Each row shows the event name, `Wednesday 16 December 2026, 14:00–18:00`, `School of Computing, Level 1`, a status (`Registered` for R Test Symposium, `Withdrawn` for R Second Talk) and `Registered <day>, <time>`. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | My registrations listed both registrations: each row showed the event name, `Wednesday 16 December 2026, 14:00–18:00`, `School of Computing, Level 1`, its status (Registered / Withdrawn) and `Registered <day>, <time>`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/r-registration.spec.ts › R3-T1 My registrations lists each registration with the event, date, times, venue location, status and registration time, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
