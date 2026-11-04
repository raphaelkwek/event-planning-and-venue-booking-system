# R3-T5 — Each entry shows the registration timestamp and, only where applicable, the withdrawal timestamp

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T5 |
| Test Scenario | Each entry shows the registration timestamp and, only where applicable, the withdrawal timestamp |
| Pre-conditions | Same as R3-T1. |
| Test Steps | 1. Click "My registrations". |
| Test Data | One Registered and one Withdrawn registration |
| Expected Result | The Withdrawn row shows `Registered <day>, <time>` and `Withdrawn <day>, <time>`, the withdrawal later than the registration. The Registered row shows `Registered <day>, <time>` and no withdrawal time. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Withdrawn row showed `Registered <day>, <time>` and `Withdrawn <day>, <time>`, with withdrawn_at later than registered_at in the database; the Registered row showed no withdrawal time. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R3-T5 each entry shows the registration time and, only where applicable, the withdrawal time, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
