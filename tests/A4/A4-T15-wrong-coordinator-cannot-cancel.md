# A4-T15 — A coordinator not assigned to an event cannot cancel it (F3), so its arrangements are not released (F4)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T15 |
| Test Scenario | A coordinator not assigned to an event cannot cancel it (F3), so its arrangements are not released (F4) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C2, send F3's cancel request for E2.<br>2. Read E2, BR1, H1 and EL1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T15 '` and read the named `A4-T15 ` result. |
| Test Data | Actor C2. E2 (Approved, assigned to C1). |
| Expected Result | HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you." E2 is still Approved; BR1, H1 and EL1 are unchanged, so nothing was released (F4). |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Not Executed: F3 (cancel an event) is not on main yet (feature-raphael/f3-cancel-event, Sprint 4). Run once F3 merges. |
| Executed By | |
| Date of Execution | |
