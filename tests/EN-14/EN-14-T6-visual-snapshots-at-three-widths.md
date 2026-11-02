# EN-14-T6 — Key screens are compared against Linux baselines at 360, 768 and 1280 px

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T6 |
| Test Scenario | Key screens are compared against Linux baselines at 360, 768 and 1280 px |
| Pre-conditions | Baselines committed under `tests/e2e/__screenshots__/`, made by CI's Linux runner. |
| Test Steps | 1. Open the `e2e` job's results for the `@visual` tests.<br>2. Check each runs in `mobile-360`, `tablet-768` and `desktop-1280`. |
| Test Data | The screens in `tests/e2e/visual.spec.ts`. |
| Expected Result | Each visual test runs once per width and compares with `toHaveScreenshot`. Dates, ids and references are masked. A run with no baseline writes one, uploads it as the `visual-baselines` artifact and fails softly until it is committed; a manual run of the workflow (`update_snapshots`) remakes them all. |
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
