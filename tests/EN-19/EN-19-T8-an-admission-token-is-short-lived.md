# EN-19-T8 — An admission token is accepted until it expires, refused with ADMISSION_EXPIRED after, and the attendee can join again

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T8 |
| Test Scenario | An admission token is accepted until it expires, refused with ADMISSION_EXPIRED after, and the attendee can join again |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A high-demand event; the token life set to 60 seconds; a clock the test controls. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T8` in `en19Cards.test.ts`, and `tests/domain/admissionToken.test.ts`. |
| Test Data | An admitted attendee's token, used at 59.999 s, at 60 s and at 61 s after admission; then the attendee joins again |
| Expected Result | At 59.999 s the register is accepted (201). At 60 s and later it is refused 403 `ADMISSION_EXPIRED` with nothing stored; the status endpoint says `EXPIRED` and gives no token. Joining again makes a new place at the back of the queue. |
| Acceptance criterion | The admission token is short-lived. |
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
