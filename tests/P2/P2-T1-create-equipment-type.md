# P2-T1 — Create an equipment type with every inventory attribute

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T1 |
| Test Scenario | Technical Support Staff create an equipment type with every required inventory attribute |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `techsupport@connectsphere.test`.<br>3. The reset has removed equipment previously created by this seeded account, so no equipment type named `P2 Wireless Microphone` exists. |
| Test Steps | 1. Click "Equipment", then "New equipment type".<br>2. Enter the test data exactly as shown.<br>3. Click "Save equipment type".<br>4. Return to "Equipment" and open the saved type. |
| Test Data | Account: `techsupport@connectsphere.test` / `ConnectSphere-Test-1234!` · Name: `P2 Wireless Microphone` · Description: `Handheld wireless microphone for talks and panels.` · Technical characteristics: `Frequency band` = `534–598 MHz`; `Connector` = `XLR`; `Power` = `2×AA` · Total quantity: `20` |
| Expected Result | "Equipment type saved." is shown. The equipment list contains `P2 Wireless Microphone` with total quantity 20. Opening it shows the exact name, description, all three technical characteristics, and total quantity entered. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Created through the form with every attribute; each value, including the characteristics, was shown as saved. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/o-equipment.spec.ts › P2-T1 technical support create an equipment type with every inventory attribute, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
