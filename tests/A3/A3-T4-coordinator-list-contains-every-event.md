# A3-T4 — A coordinator's event list contains every event, whoever owns it

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T4 |
| Test Scenario | A coordinator's event list contains every event, whoever owns it |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser@connectsphere.test`: FX-APPROVED.<br>3. As `organiser2@connectsphere.test`: FX-SUBMITTED with Event name `Organiser two's symposium`.<br>4. As `organiser@connectsphere.test`: FX-DRAFT with Event name `Unfinished idea`.<br>5. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "All events". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "Annual Research Symposium" is listed with status "Approved" and "Organiser two's symposium" with status "Submitted", whoever each is assigned to. "Unfinished idea", another user's draft, is not listed. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "All events" listed both organisers' submitted requests and no draft. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A3-T4 a coordinator's event list contains every event, whoever owns it, and no drafts, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
