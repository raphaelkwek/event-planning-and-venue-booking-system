# L6-T8 — Venue Staff move the expiry later

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T8 |
| Test Scenario | VS changes H1's expiry to a later time: HTTP 200, the reminder is armed again and a `venue-booking.hold-expiry-changed` message is written |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0013`), using the isolated setup in `tests/L6/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-L6 from `tests/L6/README.md` is loaded: venue V, VS (Venue Staff of V), event E1 (Approved, coordinator C1) and hold H1 (Held, `D 10:00`-`D 12:00` UTC, lead 60 minutes), and H1 has been reminded (L6-T6 steps 1 to 3 done, so `reminded_at` is set). |
| Test Steps | 1. As VS, send `PATCH /api/v1/holds/<H1>/expiry` with `{"expiresAt":"D-1 18:00 UTC"}`.<br>2. Read H1 and its slot, and the outbox messages for H1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/l6Cards.test.ts -t 'L6-T8 '` (or the whole suite) and read the named `L6-T8 ` result. |
| Test Data | Body as in step 1 (the new expiry is six hours after the old one and later than now). |
| Expected Result | Step 1 answers HTTP 200 with the hold: status `HELD`, `expiresAt` `D-1 18:00` UTC, `remindedAt` null. Step 2 shows `expires_at` updated, `reminded_at` null, the slot still `HELD`, and exactly one `venue-booking.hold-expiry-changed` message for H1 carrying the hold id, the new expiry and the hold's reminder lead (60 minutes). |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the L6 implementation and migration venue/0013 on the shared database, applied after the L6 PR merges (`npm run migrate -- venue`). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
