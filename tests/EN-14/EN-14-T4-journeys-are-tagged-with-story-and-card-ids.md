# EN-14-T4 — Every journey is tagged with its story and card ids, and can be run by tag

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T4 |
| Test Scenario | Every journey is tagged with its story and card ids, and can be run by tag |
| Pre-conditions | The repository checked out, and a throwaway `DATABASE_URL` on this machine set (the config refuses any other). |
| Test Steps | 1. Run `npx playwright test --config tests/playwright.config.ts --list`.<br>2. Run it again with `--grep @D4`. |
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
