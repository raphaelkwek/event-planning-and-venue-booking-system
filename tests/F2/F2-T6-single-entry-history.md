# F2-T6 — An event with one history entry shows exactly that entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T6 |
| Test Scenario | An event with one history entry shows exactly that entry |
| Pre-conditions | 1. FX-SUBMITTED completed (not opened by a coordinator).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the submitted request.<br>2. Read "Status history". |
| Test Data | Event: FX-SUBMITTED |
| Expected Result | The Status panel shows `Submitted`. "Status history" lists exactly one row: Draft to Submitted, Event Organiser, with a date and time. No empty-state message appears. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A Submitted request showed exactly one row, Draft→Submitted, and no empty-history message. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/f-status-and-confirmation.spec.ts › F2-T6 an event with one history entry shows exactly that entry, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
