# EN-19-T7 — Each attendee gets a queue position and an estimated wait, and both fall as time passes

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T7 |
| Test Scenario | Each attendee gets a queue position and an estimated wait, and both fall as time passes |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A high-demand event, the admission rate 1 per second; a clock the test controls. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T7` in `en19Cards.test.ts`. |
| Test Data | Four attendees join in order; their status is read at the start, 2 seconds later and 10 seconds later |
| Expected Result | At the start: the first is admitted at once, and the others are positions 1, 2 and 3 with estimated waits of 1, 2 and 3 seconds. After 2 s the third is admitted with a token and the fourth is position 1 with a wait of 1 s. After 10 s all four are admitted. |
| Acceptance criterion | Each attendee gets a queue position and an estimated wait. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
