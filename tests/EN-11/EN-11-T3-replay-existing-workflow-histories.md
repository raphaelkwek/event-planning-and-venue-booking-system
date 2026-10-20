# EN-11-T3 — Replay recorded histories before releasing a workflow change

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-11-T3 |
| Test Scenario | Replay recorded histories before releasing a workflow change |
| Pre-conditions | Committed baseline histories recorded from a known version, and `backend/services/planning-core/tests/temporal/replay.unit.test.ts` present. Dependencies installed; local Temporal runtime permitted. |
| Test Steps | 1. Verify the recorded baseline histories are committed and unchanged by this candidate.<br>2. From `backend/services/planning-core`, run `npx --no-install vitest run --config vitest.unit.config.ts tests/temporal/replay.unit.test.ts`.<br>3. Confirm the same replay suite is included by the CI unit-test job. Do not generate baselines from the candidate merely to make its replay pass. |
| Test Data | CompleteEvent baseline histories for completion, later rescheduling, not-due then completion, and cancellation, as named by `scripts/record-workflow-histories.ts`. |
| Expected Result | Every recorded history replays deterministically with no command mismatch; CI fails on an incompatible workflow change. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-20 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Preconditions are unmet: the recorder exists, but committed baseline histories and the replay test are absent. Recording also requires the Temporal test server that this sandbox cannot start. |
| Status | Blocked |
| Remarks | Commit: `516df57` plus the code hashes in `evidence/2026-10-20-local-ci/revision.json`. Evidence: [execution log](evidence/2026-10-20-local-ci/README.md). No Cloud worker was started. |
| Executed By | Codex |
| Date of Execution | 2026-10-20 (SGT) |
