# EN-05-T4 — The committed JSON Schema files are exactly what `contracts` generates, so they cannot go stale

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T4 |
| Test Scenario | The committed JSON Schema files are exactly what `contracts` generates, so they cannot go stale |
| Pre-conditions | 1. `backend/packages/contracts/schemas/` holds one file per message type, plus the CloudEvents envelope. |
| Test Steps | 1. Run `npm run schemas:check`.<br>2. Change a message's data schema in `contracts` without regenerating the files, and run it again.<br>3. Run `npm run schemas:generate`, then `npm run schemas:check` again.<br>4. Add a message type to `MESSAGE_DATA_SCHEMAS` without regenerating the files. |
| Test Data | The `MESSAGE_DATA_SCHEMAS` map and the committed files. |
| Expected Result | Step 1 passes. Step 2 fails and names the file that differs. Step 3 passes. Step 4 fails and says a file is missing. A file for a type that no longer exists also fails. The generated files list properties in a fixed order, so reordering fields in `contracts` changes no file. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
