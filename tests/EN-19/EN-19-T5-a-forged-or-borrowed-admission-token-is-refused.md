# EN-19-T5 — A forged, altered, wrong-event or another attendee's admission token is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T5 |
| Test Scenario | A forged, altered, wrong-event or another attendee's admission token is refused |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. Two high-demand events, A and B, and two attendees, X and Y. X has been admitted to A. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T5` in `en19Cards.test.ts`. |
| Test Data | X's token for A used: by Y on A; by X on B; with one character of the signature changed; with the payload altered to name Y; signed with a different key; and a string that is not a token |
| Expected Result | Each is refused 403 `ADMISSION_REQUIRED`, with nothing stored and no seat claimed. X's own token on A still works (201). |
| Acceptance criterion | The admission token is signed and bound to the event and the attendee. |
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
