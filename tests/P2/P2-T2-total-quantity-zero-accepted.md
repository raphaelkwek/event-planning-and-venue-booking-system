# P2-T2 — A total quantity of zero is accepted (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T2 |
| Test Scenario | Technical Support Staff create an equipment type whose total quantity is exactly zero |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `techsupport@connectsphere.test`.<br>3. The reset has removed equipment previously created by this seeded account, so no equipment type named `P2 Spare Audio Mixer` exists. |
| Test Steps | 1. Click "Equipment", then "New equipment type".<br>2. Enter the test data.<br>3. Click "Save equipment type".<br>4. Return to "Equipment". |
| Test Data | Name: `P2 Spare Audio Mixer` · Description: `Inventory type created before stock arrives.` · Technical characteristic: `Inputs` = `12` · Total quantity: `0` |
| Expected Result | The save succeeds. "Equipment type saved." is shown, and `P2 Spare Audio Mixer` appears in the equipment list with total quantity 0. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: — · Evidence: — · Defect: — · Story: P2, Sprint 2 |
| Executed By | |
| Date of Execution | |
