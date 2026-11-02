# EN-22-T9 — A weekly workflow publishes DORA metrics, and a snapshot is committed

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-22-T9 |
| Test Scenario | A weekly workflow publishes DORA metrics, and a snapshot is committed |
| Pre-conditions | 1. The workflow dora.yml on main (after merge) or run by dispatch. |
| Test Steps | 1. Check dora.yml has a schedule and workflow_dispatch and writes the job summary and an artifact.<br>2. Open documentation/evidence/EN-22/dora-2026-11-02.md. |
| Test Data | The committed snapshot. |
| Expected Result | The workflow does not commit. The snapshot states its window, definitions and numbers from the real repository. |
| Acceptance criterion | Dashboard page and snapshot. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | dora.yml is written (weekly schedule, workflow_dispatch, job summary and artifact, no commit) and the snapshot documentation/evidence/EN-22/dora-2026-11-02.md was generated locally with gh. The workflow itself has not run: a schedule or dispatch needs it on the default branch. |
| Status | Not Executed |
| Remarks | Commit: 62a261e · Evidence: the committed snapshot · Proven: the snapshot; pending: a first run of the workflow after merge · Defect: — |
| Executed By | |
| Date of Execution | |
