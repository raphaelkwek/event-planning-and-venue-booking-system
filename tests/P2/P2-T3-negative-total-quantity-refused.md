# P2-T3 — A negative total quantity is refused (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T3 |
| Test Scenario | A total quantity one below the minimum is refused and stores nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `techsupport@connectsphere.test`.<br>3. No equipment type named `P2 Negative Quantity` exists. |
| Test Steps | 1. Click "Equipment", then "New equipment type".<br>2. Enter the test data.<br>3. Click "Save equipment type".<br>4. Confirm the form remains open and the field-level refusal is shown; no equipment type is created. |
| Test Data | Name: `P2 Negative Quantity` · Description: `Boundary test record` · Technical characteristic: `Category` = `Test` · Total quantity: `-1` |
| Expected Result | The save is refused with "Total quantity must be a whole number of zero or greater." against Total quantity. The form retains the entered values for correction. No `P2 Negative Quantity` equipment type appears in the equipment list. |
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
