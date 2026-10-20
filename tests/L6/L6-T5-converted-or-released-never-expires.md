# L6-T5 — A converted or released hold is never expired

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T5 |
| Test Scenario | `expireHoldIfDue` leaves holds that are no longer Held alone, reporting `gone` with their status |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes). Two further events' holds are used so H1 stays free: H3 (Held, then converted by its coordinator as in L3-T13) and H4 (Held, then released as in L3-T15). Both are then backdated as in FX-L6's "due" step, so their expiry is an hour in the past. |
| Test Steps | 1. In a transaction, call `expireHoldIfDue(tx, H3)` and commit.<br>2. In a transaction, call `expireHoldIfDue(tx, H4)` and commit.<br>3. Read H3, H4 and their slots.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T5 '` (or the whole suite) and read the named `L6-T5 ` result. |
| Test Data | As in the steps. |
| Expected Result | Step 1 returns `gone` with status `CONVERTED`. Step 2 returns `gone` with status `RELEASED`. Step 3 shows H3 `CONVERTED` with its slot still `HELD` under the request's `BKR-` reference, H4 `RELEASED` with its slot `RELEASED`, both with `expired_at` null. No `venue-booking.hold-expired` message exists for H3 or H4. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: f7e4b7073b9607b7db396aea29c36f36bd4a5916 · Evidence: backend/services/planning-core/tests/venue/api/l6Cards.test.ts › L6-T5, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39463319772 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-21 |
