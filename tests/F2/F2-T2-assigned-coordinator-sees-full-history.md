# F2-T2 — The assigned coordinator sees the full history

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T2 |
| Test Scenario | The assigned coordinator sees the full history |
| Pre-conditions | 1. FX-APPROVED completed.<br>2. Signed in as whichever of `coordinator@connectsphere.test` / `coordinator2@connectsphere.test` the request names as "Assigned coordinator". |
| Test Steps | 1. Go to "All events" and open the event.<br>2. Read the "Status history" section. |
| Test Data | Event: FX-APPROVED |
| Expected Result | The current status `Approved` is shown, and "Status history" lists the same three entries as F2-T1. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Opened from All events, the assigned coordinator saw the same full history. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/f-status-and-confirmation.spec.ts › F2-T2 the assigned coordinator sees the full history, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
