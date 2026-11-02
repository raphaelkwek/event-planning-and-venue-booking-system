# F2-T3 — An Event Coordinator who is not assigned to the event also sees its history

## Specification

| Item | Content |
|---|---|
| Test Case ID | F2-T3 |
| Test Scenario | An Event Coordinator who is not assigned to the event also sees its history |
| Pre-conditions | 1. FX-APPROVED completed.<br>2. Signed in as the seeded coordinator who is **not** named as "Assigned coordinator". |
| Test Steps | 1. Go to "All events" and open the event.<br>2. Read the Status panel and "Status history". |
| Test Data | Event: FX-APPROVED |
| Expected Result | Event Coordinators generally see every event (A3, as revised): the status `Approved` and all three history entries are shown. |
| Created By | Joash |
| Date of Creation | 2026-10-12 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Coordinator Two, not assigned, saw the full history. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/f-status-and-confirmation.spec.ts › F2-T3 an Event Coordinator who is not assigned to the event also sees its history, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
