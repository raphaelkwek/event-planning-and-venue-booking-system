# EN-14-T7 — A failed journey is retried once in CI and leaves a trace, a video, a screenshot and the HTML report

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T7 |
| Test Scenario | A failed journey is retried once in CI and leaves a trace, a video, a screenshot and the HTML report |
| Pre-conditions | CI's `e2e` job has run. |
| Test Steps | 1. Read `retries`, `trace`, `video` and `screenshot` in `tests/playwright.config.ts`.<br>2. Open the run's artifacts. |
| Test Data | — |
| Expected Result | In CI a failed test is retried once. A failure keeps its trace, video and screenshot in `playwright-test-results`, the HTML report is uploaded as `playwright-report`, and the stack's logs as `e2e-stack-logs`. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
