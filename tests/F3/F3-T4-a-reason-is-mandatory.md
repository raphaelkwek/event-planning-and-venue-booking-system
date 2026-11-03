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
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for CI on the F3 pull request. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
