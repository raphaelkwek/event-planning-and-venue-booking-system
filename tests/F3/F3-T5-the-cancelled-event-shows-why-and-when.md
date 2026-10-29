# F3-T5 — The cancelled event stays visible to the owner and the coordinator, with its reason and date

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T5 |
| Test Scenario | After cancellation, the event's detail still opens for O and C and shows the reason, the canceller and the date |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F3 from `tests/F3/README.md` is loaded. |
| Test Steps | 1. As O, cancel E with the body below, noting `cancelledAt`.<br>2. As O, then as C, send `GET /api/v1/events/<E>`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-T5 '` and read the named `F3-T5 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Both reads answer 200 with `status` `CANCELLED`, `cancellationReason` `The speaker withdrew.`, `cancelledBy` O and `cancelledAt` as in step 1. |
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
