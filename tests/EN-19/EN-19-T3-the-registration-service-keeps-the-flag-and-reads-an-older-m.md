# EN-19-T3 — The registration service keeps the flag from event.listing-changed, and a message without it reads as not high-demand

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T3 |
| Test Scenario | The registration service keeps the flag from event.listing-changed, and a message without it reads as not high-demand |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests named `EN-19-T3` in `backend/services/registration/tests/consumer/handleListing.test.ts`; run `npm test -w @connectsphere/contracts` for the contract. |
| Test Data | Listing messages with highDemand true, then false, and one published before this change (no highDemand field) |
| Expected Result | The listing row's `high_demand` is true after the first, false after the second and false for the older message. The contract accepts a message with and without the field and refuses a non-boolean. |
| Acceptance criterion | The flag is an event field published on event.listing-changed. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The registration listing's high_demand followed each message (true, false, true, then false for a message with no field); the contract accepted a listing with and without the flag and refused a non-boolean. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/packages/contracts/tests/cloudEvent.test.ts › EN-19-T3 carries the high-demand flag, and reads a listing published before the flag existed as not high-demand || backend/services/registration/tests/consumer/handleListing.test.ts › EN-19-T3 keeps the high-demand flag from each listing, and reads a message without it as not flagged, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
