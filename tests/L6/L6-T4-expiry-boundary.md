# L6-T4 — One second before the expiry the hold is not due; at the expiry it is

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T4 |
| Test Scenario | Boundary of `expireHoldIfDue`: `expires_at` one second after the database's now() leaves H1 Held; `expires_at` equal to now() expires it |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes). Both parts run in one transaction each, so the database's `now()` is fixed for the whole call. |
| Test Steps | 1. In a transaction, set H1's `expires_at` to `now() + interval '1 second'` (with `placed_at` moved earlier so the constraint holds), then call `expireHoldIfDue(tx, H1)` in the same transaction and commit.<br>2. Read H1 and its slot.<br>3. In a new transaction, set `expires_at` to `now()`, call `expireHoldIfDue(tx, H1)` and commit.<br>4. Read H1 and its slot.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T4 '` (or the whole suite) and read the named `L6-T4 ` result. |
| Test Data | Expiry offsets: `+1 second` (step 1), `+0 seconds` (step 3). |
| Expected Result | Step 1 returns `not-due` with `expiresAt` equal to that expiry. Step 2 shows H1 `HELD`, `expired_at` null, slot `HELD`, no `hold-expired` message. Step 3 returns `expired`. Step 4 shows H1 `EXPIRED` with `expired_at` set and the slot `EXPIRED`, and exactly one `venue-booking.hold-expired` message. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: f7e4b7073b9607b7db396aea29c36f36bd4a5916 · Evidence: backend/services/planning-core/tests/venue/api/l6Cards.test.ts › L6-T4, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39463319772 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-21 |
