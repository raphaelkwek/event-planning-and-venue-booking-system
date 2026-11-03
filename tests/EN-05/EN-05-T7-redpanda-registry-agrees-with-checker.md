# EN-05-T7 — A real schema registry (Redpanda's) gives the same verdict as the checker, and the branch passes the registry's own compatibility check

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-05-T7 |
| Test Scenario | A real schema registry (Redpanda's) gives the same verdict as the checker, and the branch passes the registry's own compatibility check |
| Pre-conditions | 1. A single-node Redpanda container, started by the CI job. Its Schema Registry is the one the staging and production cluster runs. |
| Test Steps | 1. Start Redpanda in the CI job and wait for the registry to answer.<br>2. For every case in the checker's table of compatible and incompatible changes, register the previous schema under a throwaway subject set to BACKWARD, and ask the registry whether the changed schema is compatible.<br>3. Register the base branch's message schemas, and ask the registry about each of the branch's.<br>4. Compare the registry's answers with the checker's. |
| Test Data | The cases in `backend/packages/contracts/src/compat/cases.ts`, and the committed schema files of the base branch and the branch. |
| Expected Result | The registry's verdict equals the checker's and the case's expected verdict, for every case. Every message schema of the branch is compatible with its base version in the registry. A disagreement fails the job and names the case. |
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
