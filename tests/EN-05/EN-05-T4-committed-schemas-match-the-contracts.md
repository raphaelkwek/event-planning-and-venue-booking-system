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
| Actual Result | The 30 committed files equal what contracts generates, text for text (step 1). A committed file that differs is reported as "differs: <file> is not what contracts generates" (step 2). generate then check passes in a repository that had no files (step 3). A message type with no file is reported as missing, a file with no message type as stale, and both make check exit 1 (step 4). Reordering fields in zod changes no file. |
| Status | Pass |
| Remarks | Automated (unit test, CI) · Commit: c4325fb · Evidence: backend/packages/contracts/tests/compat/snapshot.test.ts › EN-05-T4 holds exactly the files contracts generates, with the same text; backend/packages/contracts/tests/compat/cli.test.ts › EN-05-T4 check fails and names a file whose contents differ; backend/packages/contracts/tests/compat/script.test.ts › EN-05-T4 generate writes the files that check then accepts, EN-05-T4 check fails in a repository whose committed files are not what contracts generates; CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614891360 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
