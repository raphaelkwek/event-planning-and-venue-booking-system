# R3-T2 — Registrations belonging to other attendees are never listed

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T2 |
| Test Scenario | Registrations belonging to other attendees are never listed |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults, then FX-R-OTHER-ATTENDEE on it.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "My registrations". |
| Test Data | One registration for another attendee (`00000000-0000-0000-0000-0000000000a5`), none for Attendee One |
| Expected Result | The list is empty and says `You have no registrations yet.`. The other attendee's registration is not shown. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | My registrations showed `You have no registrations yet.` and none of the other attendee's registration (no reference, no event name). Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R3-T2 another attendee's registrations are never listed, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
