# F2-T5 — History entries are chronological and show previous status, new status, role and time

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T5 |
| Test Scenario | History entries are chronological and show previous status, new status, role and time |
| Pre-conditions | 1. FX-REJECTED completed.<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the rejected request.<br>2. Read every row of "Status history". |
| Test Data | Event: FX-REJECTED (Draft, Submitted, Under Review, Rejected) |
| Expected Result | The rows run oldest first: Draft to Submitted, Submitted to Under Review, Under Review to Rejected. Every row shows a From status, a To status, the acting user's role and a date and time; each row's From equals the To of the row above it, and no time is earlier than the row above. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Three rows; each From equalled the previous To and no time was earlier than the one before. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/f-status-and-confirmation.spec.ts › F2-T5 history entries are chronological and show the previous and new status, role and time, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
