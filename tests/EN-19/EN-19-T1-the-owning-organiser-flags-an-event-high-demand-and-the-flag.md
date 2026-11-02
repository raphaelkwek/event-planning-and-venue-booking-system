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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
