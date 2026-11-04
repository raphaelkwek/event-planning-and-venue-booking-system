# F3-T4 — Without a reason, or with a blank one, nothing changes

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T4 |
| Test Scenario | A cancellation with no reason, an empty reason or a reason of spaces is refused and changes nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F3 from `tests/F3/README.md` is loaded. |
| Test Steps | 1. Read E, its history, slots, lines, reservations, change requests and messages.<br>2. As O, send `POST /api/v1/events/<E>/cancellation` with each body below.<br>3. Read them again.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-T4 '` and read the named `F3-T4 ` result. |
| Test Data | `{}`, `{"reason":""}`, `{"reason":"   "}` |
| Expected Result | Each request answers 400 `VALIDATION_FAILED` with the field `reason` and the message `Give a reason for cancelling the event.` Step 3 finds everything as in step 1: E still Planning, B1 Confirmed, R1 Reserved, CR Pending, no new message. |
| Created By | Raphael |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | As O, each of no reason, an empty reason and a reason of spaces answered 400 `VALIDATION_FAILED` with the single field error `reason`, `Give a reason for cancelling the event.` E's row (still `PLANNING`), its history count, slots, equipment lines, reservations, change requests and E's event-outbox count were the same after the three requests as before. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 5eb3bfd · Evidence: `backend/services/planning-core/tests/change/api/f3Cards.test.ts` › F3 cards (tests/F3) › F3-T4 without a reason, or with a blank one, nothing changes, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
