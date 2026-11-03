# D2-T2 — An empty clarification message is refused, storing nothing (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T2 |
| Test Scenario | An empty clarification message is refused, storing nothing (boundary: just below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Leave the message under "Ask for clarification" empty.<br>2. Click "Send clarification request". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Message: *(empty)* |
| Expected Result | The request is refused with `VALIDATION_FAILED` "A clarification message is required.". "Clarifications" still reads "None requested." and the status is still "Under Review". |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with the message-required error; the status stayed Under Review and nothing was stored. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D2-T2 an empty clarification message is refused and nothing is stored, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
