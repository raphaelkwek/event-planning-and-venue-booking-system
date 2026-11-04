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
| Actual Result | dora.yml has a weekly schedule (`30 16 * * 0`) and workflow_dispatch, writes dora.md to the job summary and uploads it as the `dora-metrics` artifact, with read-only permissions and no commit step. Dispatched on main (b3d9a66) on 4 Nov: run 41787255948 succeeded and uploaded dora-metrics (window 2026-10-05 to 2026-11-04: 2.43 deployments a day from 73 green main runs and 96 merged pull requests); main gained no commit from it. The committed snapshot documentation/evidence/EN-22/dora-2026-11-02.md states its window (2026-10-03 to 2026-11-02, 30 days), the definition of each of the four metrics, and numbers from the repository's own runs and pull requests (50 green main runs, 56 merges). |
| Status | Pass |
| Remarks | Workflow run and document review · Commit: b3d9a66 · Evidence: https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41787255948 (artifact dora-metrics), documentation/evidence/EN-22/dora-2026-11-02.md · Defect: — |
| Executed By | Joash, via a dispatched workflow run |
| Date of Execution | 2026-11-04 |
