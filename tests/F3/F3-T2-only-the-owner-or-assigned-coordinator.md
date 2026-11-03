# F3-T2 — The assigned coordinator may cancel; another coordinator gets 403 and another organiser 404, changing nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T2 |
| Test Scenario | Only the owner or the assigned coordinator may cancel |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F3 from `tests/F3/README.md` is loaded. |
| Test Steps | 1. As C2 (an Event Coordinator not assigned to E), send `POST /api/v1/events/<E>/cancellation` with the body below.<br>2. As O2 (an organiser who does not own E), send the same.<br>3. As T (Technical Support), send the same.<br>4. Read E, its history, slots, lines, reservations, change requests and messages.<br>5. As C, send the same.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-T2 '` and read the named `F3-T2 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 1 answers 403 `ROLE_NOT_AUTHORISED` "Only the event's owner or its assigned coordinator can cancel it."; step 2 answers 404 `EVENT_NOT_FOUND`; step 3 answers 403. Step 4 finds everything as before step 1. Step 5 answers 200 with `event.status` `CANCELLED` and `cancelledBy` C. |
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
