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
| Actual Result | The token for attendee X on event A was refused 403 ADMISSION_REQUIRED for attendee Y, for event B, with a changed signature, with the payload altered to name Y, signed with another key, and as a non-token string; nothing stored. X's own token then registered (201). |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/api/en19Cards.test.ts › EN-19-T5 refuses a forged, altered, wrong-event or borrowed token and accepts the attendee's own || backend/services/registration/tests/domain/admissionToken.test.ts › EN-19-T5 accepts its own token and returns what it admits ; EN-19-T5 refuses another event's token and another attendee's token ; EN-19-T5 refuses a token signed with another key, one with its signature changed, and one with its payload changed ; EN-19-T5 refuses a missing token and anything that is not a token ; EN-19-T5 never signs or accepts under an empty key, which anyone could forge || backend/services/registration/tests/service/waitingRoom.unit.test.ts › EN-19-T5 admits with a token that names the event, the attendee and the moment it expires, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
