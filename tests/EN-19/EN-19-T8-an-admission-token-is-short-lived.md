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
| Actual Result | A token registered 1 ms before it expired (201), and was refused 403 ADMISSION_EXPIRED at its expiry instant and 1 s after, storing nothing; the status said EXPIRED with no token; joining again made a new place (201). |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/api/en19Cards.test.ts › EN-19-T8 accepts a token until it expires, then refuses it with ADMISSION_EXPIRED and lets the attendee join again || backend/services/registration/tests/domain/admissionToken.test.ts › EN-19-T8 accepts a token up to the instant before it expires, and refuses it at that instant and after || backend/services/registration/tests/domain/refusals.test.ts › EN-19-T8 say the attendee's turn has passed and to join again || backend/services/registration/tests/domain/waitingRoom.test.ts › EN-19-T8 waits until the slot, is admitted from it, and is expired once the token's life is over || backend/services/registration/tests/service/waitingRoom.unit.test.ts › EN-19-T8 gives an attendee whose turn expired, or who used it, a new place, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
