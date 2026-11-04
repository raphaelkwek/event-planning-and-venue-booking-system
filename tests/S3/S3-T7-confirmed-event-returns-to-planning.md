# S3-T7 — An approved change to a Confirmed event returns it to Planning

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T7 |
| Test Scenario | E is Confirmed: approval moves it to Planning through `RECONSIDER_AFTER_CHANGE`, with a history entry, and its flags remain |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else; E is in status Confirmed (a fresh FX-S3 whose E is Confirmed). |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As C, send `GET /api/v1/events/<E>` and read the status and history.<br>3. As C, send `GET /api/v1/events/<E>/arrangement-flags`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T7 '` (or the whole suite) and read the named `S3-T7 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00` (event E moves from `D 14:00`–`D 18:00` to `D 15:00`–`D 18:00`), nothing else. |
| Expected Result | Step 1 answers HTTP 200. In step 2 E's status is `PLANNING`, and its history has a status-change entry `CONFIRMED` → `PLANNING` with transition `RECONSIDER_AFTER_CHANGE` by C, as well as the `proposedStartAt` FIELD_CHANGE. Step 3 still lists the flags on B1, B2 and R1. As a follow-up, `POST /api/v1/events/<E>/confirmation` (F5) as C answers 422 `ARRANGEMENTS_NOT_READY` while the flags exist (see S3-T9). |
| Created By | Raphael |
| Date of Creation | 2026-10-28 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | With E Confirmed, the approval answered 200 and `GET /api/v1/events/<E>` showed `PLANNING`. E's history had exactly one STATUS_CHANGE, `CONFIRMED` → `PLANNING`, action `RECONSIDER_AFTER_CHANGE`, by C as `EVENT_COORDINATOR`, and one FIELD_CHANGE, `proposedStartAt`. `GET .../arrangement-flags` answered 200 with exactly B1 and B2 `REQUIRES_RECONFIRMATION` and R1 `FLAGGED_FOR_REVIEW`. F5 confirmation as C then answered 422 `ARRANGEMENTS_NOT_READY`. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: a406635 · Evidence: `backend/services/planning-core/tests/change/api/s3Cards.test.ts` › S3 cards: reconsidering the arrangements an approved change affects › S3-T7 a Confirmed event returns to Planning with a history entry, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
