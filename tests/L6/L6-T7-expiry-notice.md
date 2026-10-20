# L6-T7 — The coordinator is told when the hold expires

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T7 |
| Test Scenario | When H1 expires, one `venue-booking.hold-expired` message is written and C1 gets one notice naming the venue, period, event and expiry time |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes) and the FX-L6 "due" step is applied to H1: expiry one hour ago, lead 60 minutes, `reminded_at` null. |
| Test Steps | 1. In a transaction, call `expireHoldIfDue(tx, H1)` and commit.<br>2. Call `expireHoldIfDue(tx, H1)` again.<br>3. Read the outbox messages and C1's notices.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T7 '` (or the whole suite) and read the named `L6-T7 ` result. |
| Test Data | As in the steps. |
| Expected Result | Step 1 returns `expired`. Step 2 returns `gone` with status `EXPIRED`. Step 3 shows exactly one `venue-booking.hold-expired` message for H1 and exactly one notice to C1 naming `Lee Kong Chian Auditorium`, the period `D 18:00-20:00` Singapore time, E1's reference and name, and the expiry time (Singapore time). No other actor has a notice, and no `hold-expiring` notice is created by this card. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: f7e4b7073b9607b7db396aea29c36f36bd4a5916 · Evidence: backend/services/planning-core/tests/venue/api/l6Cards.test.ts › L6-T7, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39463319772 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-21 |
