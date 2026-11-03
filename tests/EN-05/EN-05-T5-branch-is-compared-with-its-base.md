# EN-05-T5 — The command compares this branch's schemas with the ones on its base branch and exits non-zero only for a breaking change

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T5 |
| Test Scenario | The command compares this branch's schemas with the ones on its base branch and exits non-zero only for a breaking change |
| Pre-conditions | 1. A git repository whose base commit holds the committed schema files.<br>2. The branch's schemas generated from `contracts`. |
| Test Steps | 1. Run `npm run schemas:compat -- --base <ref>` where the branch changes nothing.<br>2. Run it where the branch adds an optional field.<br>3. Run it where the branch removes a required field.<br>4. Run it where the base ref holds no schema files yet.<br>5. Run it with a base ref that does not exist. |
| Test Data | A temporary git repository built by the test, and fake sources for the pure cases. |
| Expected Result | Steps 1 and 2 exit 0 and print what was compared. Step 3 exits 1 and prints the finding. Step 4 exits 0 and says there is nothing to compare with yet. Step 5 exits non-zero with a message that names the ref, rather than passing silently. |
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
