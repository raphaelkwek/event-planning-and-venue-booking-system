# B2-T1 — Submitting with every mandatory field empty names each one at once

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T1 |
| Test Scenario | Submitting with every mandatory field empty names each one at once |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Leave every field empty and both checkboxes unticked.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Submission is refused with `VALIDATION_FAILED`. The one refusal names all six at once — Event name, Purpose, Description, Proposed start, Proposed end and Expected attendance — and each shows its own message under its field. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | One refusal named every mandatory field, each message bound to its field. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/b-event-requests.spec.ts › B2-T1 submitting with every mandatory field empty names each one at once, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |