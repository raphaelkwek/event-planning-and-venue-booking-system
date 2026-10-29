# F4-T7 — No registration is released and no attendee is told, since there is no registration service yet

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T7 |
| Test Scenario | F4-AC4 waits for EN-13: the response says no registration was released |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including F3's `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F4/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F4 from `tests/F4/README.md` is loaded. |
| Test Steps | 1. As O, cancel E with the body below.<br>2. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f4Cards.test.ts -t 'F4-T7 '` and read the named `F4-T7 ` result. |
| Test Data | `{"reason":"The speaker withdrew."}` |
| Expected Result | Step 1 answers 200 with `released.registrations` 0. This card is rewritten when EN-13 adds registrations. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F4's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for CI on the F4 pull request. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
