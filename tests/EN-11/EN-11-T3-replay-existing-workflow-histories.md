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
| Actual Result | Step 1: the four baseline histories are committed in tests/temporal/histories/ (recorded once from this branch's workflow with scripts/record-workflow-histories.ts; there is no earlier version to compare against). Step 2: `vitest run tests/temporal/replay.unit.test.ts`: 7 tests passed: the four histories replay deterministically, a history with its timer removed is rejected, and a history round-trips to the same text. Step 3: the file matches the unit config's include pattern, and the full `npm run test:unit` (58 files, 820 tests) ran it and passed. |
| Status | Pass |
| Remarks | Commit: d6ddffb · Evidence: the vitest output and the committed histories · Environment: local unit run on Temporal's time-skipping test server (no Docker, no Temporal Cloud) · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |