# S1-T12 — The venue and equipment requirements keep their shapes

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T12 |
| Test Scenario | Valid venue and equipment requirements are accepted with null snapshots, and a malformed venue requirement is refused on its field |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS. |
| Test Steps | 1. As ORG, send `POST /api/v1/events/<E1>/change-requests` with body (a) in Test Data.<br>2. In a fresh FX-S1 (the request in step 1 is still pending on E1), as ORG, send the same request with body (b).<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T12 '` (or the whole suite) and read the named `S1-T12 ` result. |
| Test Data | (a) `{"reason":"x","changes":{"venueRequirements":<a valid venue requirements object>,"equipmentRequired":true,"equipmentRequirements":[<one valid equipment line>]}}`, using the same shapes as the event API accepts; (b) `{"reason":"x","changes":{"venueRequirements":"big room"}}` |
| Expected Result | (a) HTTP 201 with fields `venueRequirements`, `equipmentRequired` and `equipmentRequirements`: the snapshots of `venueRequirements` and `equipmentRequirements` are null, that of `equipmentRequired` is false, and the proposed values are echoed as sent. (b) HTTP 400 `VALIDATION_FAILED` naming `changes.venueRequirements`, and nothing stored. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 814b6695b826bc05114f1f5360f3d5739d3ad5e9 · Evidence: backend/services/planning-core/tests/change/api/s1Cards.test.ts › S1-T12, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39051697005 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-18 |
