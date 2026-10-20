# L6-T11 — L3's placement rules still refuse a missing or past expiry

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T11 |
| Test Scenario | Re-running L3's cards unchanged shows placing a hold with a missing or past expiry is refused and stores nothing |
| Pre-conditions | 1. L3's existing cards and tests are unchanged on this branch (`tests/L3`, `backend/services/planning-core/tests/venue/api/holds.test.ts` and `backend/services/planning-core/tests/venue/domain/hold.test.ts`).<br>2. Clean throwaway Postgres with every migration applied (including `venue/0013`), as `tests/L6/README.md`. |
| Test Steps | 1. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/holds.test.ts tests/venue/domain/hold.test.ts`.<br>2. Read the results named L3-T6 (expiry at or before placing refused, a minute later accepted) and L3-T5 (placed hold records the expiry).<br>3. Optionally walk `tests/L3/L3-T6-expiry-must-be-after-placement.md` by hand. |
| Test Data | L3-T6's own data; nothing new. |
| Expected Result | Every L3 test passes unchanged. In L3-T6 an expiry a minute ago and a missing expiry answer 400 `VALIDATION_FAILED` on `expiresAt` ("The expiry must be later than now." and "Enter the expiry date and time."), the hold stays Requested with no slot, and an expiry two minutes ahead answers 200 with the hold Held. No L3 card or test is edited by L6. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | L3's placement tests, which this card points at, ran in the same CI run and passed: a missing or past expiry is still refused and stores nothing. |
| Status | Pass (automated, API level) |
| Remarks | Commit: f7e4b7073b9607b7db396aea29c36f36bd4a5916 · Evidence: backend/services/planning-core/tests/venue/api/holds.test.ts and tests/venue/domain/hold.test.ts, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39463319772 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-21 |
