# EN-19-T4 — Registering for a high-demand event without an admission token is refused with ADMISSION_REQUIRED, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T4 |
| Test Scenario | Registering for a high-demand event without an admission token is refused with ADMISSION_REQUIRED, and nothing is stored |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A Confirmed, open event with 3 seats, flagged high-demand. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T4` in `backend/services/registration/tests/api/en19Cards.test.ts`. |
| Test Data | POST /api/v1/registrations as an attendee with no X-Admission-Token header, then with an empty one |
| Expected Result | 403 `ADMISSION_REQUIRED`, a message that says to join the waiting room first. No registration, no seat claimed (3 places remain), no outbox message. |
| Acceptance criterion | For a high-demand event the register route requires a short-lived signed admission token; a register without one is refused with a clear code. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A register with no token and with an empty token was 403 ADMISSION_REQUIRED naming the event and the waiting room; no registration, no outbox message, 3 places remaining. With no signing key, register and join were 503 WAITING_ROOM_UNAVAILABLE. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/api/en19Cards.test.ts › EN-19-T4 refuses a register without an admission token for a high-demand event, storing nothing ; EN-19-T4 (no signing key) refuses a flagged event and its waiting room with WAITING_ROOM_UNAVAILABLE rather than take registrations unchecked || backend/services/registration/tests/domain/refusals.test.ts › EN-19-T4 say a high-demand event needs the waiting room first, naming the event || backend/services/registration/tests/service/waitingRoom.unit.test.ts › EN-19-T4 will not queue anyone when there is no key to sign admission tokens with ; EN-19-T4 never mints a token without a key, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
