# EN-19-T9 — An admission token admits one registration: after it is used, registering again with it is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T9 |
| Test Scenario | An admission token admits one registration: after it is used, registering again with it is refused |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A high-demand event with 3 seats; an admitted attendee. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T9` in `en19Cards.test.ts`. |
| Test Data | Register with the token (201); withdraw; register again with the same token; poll the status |
| Expected Result | The first register is 201. After withdrawing, the same token is refused 403 `ADMISSION_REQUIRED`, nothing stored. The status endpoint reports `USED` and no token. A refusal for capacity does not use the token. |
| Acceptance criterion | The admission token is short-lived and signed; one admission cannot be reused for many registrations. |
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
