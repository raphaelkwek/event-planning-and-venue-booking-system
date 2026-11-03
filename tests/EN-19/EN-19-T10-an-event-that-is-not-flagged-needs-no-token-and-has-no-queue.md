# EN-19-T10 — An event that is not flagged high-demand takes registrations without a token, and its waiting room refuses to queue anyone

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T10 |
| Test Scenario | An event that is not flagged high-demand takes registrations without a token, and its waiting room refuses to queue anyone |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. An open event with 3 seats, not flagged. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T10` in `en19Cards.test.ts`. |
| Test Data | Register with no token; join the waiting room; join the waiting room of an unknown event; join a flagged event before its window opens |
| Expected Result | Registering gives 201. Joining gives 409 `WAITING_ROOM_NOT_REQUIRED`; an unknown event 404 `EVENT_NOT_FOUND`; a flagged event whose window has not opened 422 `REGISTRATION_OUTSIDE_WINDOW`. No queue entry is stored by a refusal. |
| Acceptance criterion | Admission tokens are required for events flagged high-demand only. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | An unflagged event took a registration without a token (201); joining its waiting room was 409 WAITING_ROOM_NOT_REQUIRED, an unknown event 404, a flagged event before its window 422 REGISTRATION_OUTSIDE_WINDOW, a bad id 400; no entry was stored. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/api/en19Cards.test.ts › EN-19-T10 needs no token for an unflagged event and queues nobody for it || backend/services/registration/tests/domain/refusals.test.ts › EN-19-T10 say an event that is not high-demand has no waiting room || backend/services/registration/tests/service/waitingRoom.unit.test.ts › EN-19-T10 answers not found for an event it does not know, or one that takes no registrations ; EN-19-T10 has no queue for an event that is not high-demand, and writes nothing ; EN-19-T10 will not queue anyone before registration opens or after it closes, naming the state, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
