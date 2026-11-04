# R5-T2 — The assigned coordinator sees the same registration list as the owning organiser

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T2 |
| Test Scenario | The assigned coordinator sees the same registration list as the owning organiser |
| Pre-conditions | 1. R5-T1's pre-conditions 1–3.<br>2. Signed in as `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. open `#/events/<EVENT_ID>/registrations` (the "Registrations" button on the event). |
| Test Data | As R5-T1 |
| Expected Result | The same row and totals as R5-T1. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Coordinator One, the assigned coordinator, saw the same single row (`Attendee One`, the registration time, `Registered`, `Self-registered`) and the same totals: `Registered 1`, `Withdrawn 0`, `Places remaining 2`, `Capacity 3`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R5-T2 the assigned coordinator sees the same list, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
