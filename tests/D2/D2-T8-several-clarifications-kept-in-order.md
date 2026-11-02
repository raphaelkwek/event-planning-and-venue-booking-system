# D2-T8 — Several clarifications on one request are kept in order, not overwritten

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T8 |
| Test Scenario | Several clarifications on one request are kept in order, not overwritten |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed; note the request id. The coordinator is on the review screen. |
| Test Steps | 1. Send the first question.<br>2. Sign out, sign in as `organiser@connectsphere.test`, open the request, enter the first answer under "Respond", and click "Send response".<br>3. Sign out, sign in as `coordinator@connectsphere.test`, open the request, and send the second question.<br>4. Read "Clarifications". |
| Test Data | Accounts: `coordinator@connectsphere.test`, `organiser@connectsphere.test` — both `ConnectSphere-Test-1234!`<br>First question: `First question` · First answer: `First answer` · Second question: `Second question` |
| Expected Result | "Clarifications" lists "First question" with the organiser's reply "First answer", then "Second question" below it. Neither question has replaced the other. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both clarifications were listed, oldest first, neither overwritten. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D2-T8 several clarifications on one request are kept in order, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
