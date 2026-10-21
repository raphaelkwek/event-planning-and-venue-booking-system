# L6-T6 — The coordinator is reminded at expiry minus the lead time, once

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T6 |
| Test Scenario | At H1's expiry minus 60 minutes `remindHoldIfDue` writes one `venue-booking.hold-expiring` message and one notice to C1; a second call sends nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes), but H1's expiry is `D-1 12:00` UTC with lead 60 minutes, so the reminder is due at `D-1 11:00` UTC. The test passes the clock to `remindHoldIfDue` (its optional `now` argument). |
| Test Steps | 1. In a transaction, call `remindHoldIfDue(tx, H1, <D-1 10:59:59 UTC>)` and commit.<br>2. In a transaction, call `remindHoldIfDue(tx, H1, <D-1 11:00:00 UTC>)` and commit.<br>3. Call `remindHoldIfDue(tx, H1, <D-1 11:00:00 UTC>)` again.<br>4. Read H1's `reminded_at`, the outbox messages and C1's notices.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T6 '` (or the whole suite) and read the named `L6-T6 ` result. |
| Test Data | Expiry `D-1 12:00` UTC (`D-1 20:00` Singapore time); lead 60 minutes. |
| Expected Result | Step 1 returns `not-due` with `remindAt` `D-1 11:00:00` UTC. Step 2 returns `reminded`. Step 3 returns `already`. Step 4 shows `reminded_at` set once, exactly one `venue-booking.hold-expiring` message for H1, and exactly one notice to C1 naming `Lee Kong Chian Auditorium` (V), the period `D 18:00-20:00` Singapore time, E1's reference and name (`Annual Research Symposium`) and the expiry `D-1 20:00` Singapore time. VS and every other actor have no such notice. H1 stays `HELD`. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: f7e4b7073b9607b7db396aea29c36f36bd4a5916 · Evidence: backend/services/planning-core/tests/venue/api/l6Cards.test.ts › L6-T6, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39463319772 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-21 |
