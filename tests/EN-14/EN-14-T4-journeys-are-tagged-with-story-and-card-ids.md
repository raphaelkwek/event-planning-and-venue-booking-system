# EN-14-T4 — Every journey is tagged with its story and card ids, and can be run by tag

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T4 |
| Test Scenario | Every journey is tagged with its story and card ids, and can be run by tag |
| Pre-conditions | CI's `e2e` job has run the journeys and written `tests/test-results/results.json`. |
| Test Steps | 1. Open the `e2e` job's step "Check every journey is tagged with its story and card": it runs `.github/scripts/e2e-tags-check.mjs` over every test in the report.<br>2. In the same step, read the output of `npx playwright test --config tests/playwright.config.ts --list --grep @D4`. |
| Test Data | — |
| Expected Result | Every listed test's title starts with a card id, and its tags include the story (e.g. `@D4`) and the card (e.g. `@D4-T1`). With `--grep @D4` only D4's journeys are listed. |
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
