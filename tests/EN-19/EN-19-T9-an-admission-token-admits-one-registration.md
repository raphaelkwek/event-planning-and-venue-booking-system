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
| Actual Result | The first token registered (201) and then showed USED; a capacity refusal (409) left the second attendee's token valid; after a withdrawal the first token was refused 403 ADMISSION_REQUIRED; the second attendee's unspent token then registered (201). |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/api/en19Cards.test.ts › EN-19-T9 spends a token on the registration it admits, and not on a refusal || backend/services/registration/tests/domain/waitingRoom.test.ts › EN-19-T9 is used once spent, whatever the time || backend/services/registration/tests/service/waitingRoom.unit.test.ts › EN-19-T9 shows a spent place as used, with no token, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
