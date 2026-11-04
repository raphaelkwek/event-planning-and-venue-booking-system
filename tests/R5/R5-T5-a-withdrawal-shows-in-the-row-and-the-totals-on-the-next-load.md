# R5-T5 — A withdrawal is reflected in both the row status and the totals when the list is next loaded

## Specification

| Item | Content |
|---|---|
| Test Case ID | R5-T5 |
| Test Scenario | A withdrawal is reflected in both the row status and the totals when the list is next loaded |
| Pre-conditions | 1. R5-T1's pre-conditions 1–4, and the list open as in R5-T1. |
| Test Steps | 1. In another browser, as Attendee One, withdraw the registration (R4-T1 steps 1–3).<br>2. Reload the organiser's list. |
| Test Data | As R5-T1 |
| Expected Result | Before: `Registered 1`, `Withdrawn 0`, `Places remaining 2`. After: the row reads `Withdrawn` with its withdrawal time, and `Registered 0`, `Withdrawn 1`, `Places remaining 3`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Before: `Registered 1`, `Withdrawn 0`, `Places remaining 2`, `Capacity 3`, the row `Registered`. In a second browser Attendee One withdrew from My registrations (200). After the organiser reloaded, the row read `Withdrawn` and `Withdrawn <time>` (the stored withdrawal time), and the totals `Registered 0`, `Withdrawn 1`, `Places remaining 3`, `Capacity 3`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R5-T5 a withdrawal shows in the row and the totals when the list is next loaded, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
