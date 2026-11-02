# EN-19-T1 — The owning organiser flags an event high-demand, and the flag is published on event.listing-changed

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T1 |
| Test Scenario | The owning organiser flags an event high-demand, and the flag is published on event.listing-changed |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. An Approved event owned by Organiser One, with registration required. |
| Test Steps | 1. Run `npm test -w @connectsphere/planning-core`.<br>2. Find the tests named `EN-19-T1` in `backend/services/planning-core/tests/event/api/highDemand.test.ts` and in `.../tests/event/events/listingChanged.test.ts`. |
| Test Data | PUT /api/v1/events/{id}/high-demand with {"highDemand": true}, then {"highDemand": false}; If-Match carries the version loaded |
| Expected Result | The event answers 200 with `highDemand` true and a new version; a history entry records the change; one `event.listing-changed` message is in the event outbox with `highDemand: true`. Setting it back writes a second message with `false`. Sending the same value again writes nothing. |
| Acceptance criterion | An organiser can mark an event high-demand: an event field, published on event.listing-changed. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | planning-core integration run: PUT /high-demand by the owner flagged then unflagged the event (200, new version, ETag), wrote one history entry per change and one event.listing-changed per change carrying highDemand; the same value again wrote nothing. The listing message test and the pure rules passed. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/planning-core/tests/event/api/highDemand.test.ts › EN-19-T1 lets the owning organiser flag and unflag an event, publishing each change on event.listing-changed || backend/services/planning-core/tests/event/domain/highDemand.test.ts › accepts exactly true or false (EN-19-T1) || backend/services/planning-core/tests/event/events/listingChanged.test.ts › EN-19-T1 carries the event's high-demand flag, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
