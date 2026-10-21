# L6-T1 — The expiry passes and the hold becomes Expired, kept, with its slot expired

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T1 |
| Test Scenario | Once H1's expiry has passed, `expireHoldIfDue` marks the hold and its slot Expired, stamps `expired_at`, keeps the record and writes the `venue-booking.hold-expired` message |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes), then the FX-L6 "due" step is applied: H1's `placed_at` and `expires_at` are moved back two hours, so H1 expired one hour ago and is still `HELD`. |
| Test Steps | 1. In a transaction, call `expireHoldIfDue(tx, H1)` and commit.<br>2. Read H1 and its slot with the "Looking a hold up" query in `tests/L6/README.md`.<br>3. Read the venue outbox for messages about H1.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T1 '` (or the whole suite) and read the named `L6-T1 ` result. |
| Test Data | H1 as in FX-L6, backdated: expiry one hour ago, lead 60 minutes. |
| Expected Result | Step 1 returns `expired`. Step 2 shows H1 status `EXPIRED`, `expired_at` set to a moment within the last minute, `expires_at` unchanged, `placed_by` and `requested_by` unchanged, and its slot status `EXPIRED` (the row is kept, not deleted). Step 3 shows exactly one message `venue-booking.hold-expired` for H1, carrying H1's id, the venue, the period and the expiry time. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: f7e4b7073b9607b7db396aea29c36f36bd4a5916 · Evidence: backend/services/planning-core/tests/venue/api/l6Cards.test.ts › L6-T1, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39463319772 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-21 |
