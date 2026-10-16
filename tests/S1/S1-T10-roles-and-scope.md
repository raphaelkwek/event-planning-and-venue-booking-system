# S1-T10 — Only the owning organiser can request a change

## Specification

| Item | Content |
|---|---|
| Test Case ID | S1-T10 |
| Test Scenario | Every other actor is refused with one fixed outcome, an unknown event is not found, and nothing is stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001`), using the isolated setup in `tests/S1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S1 from `tests/S1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not required, venue and equipment requirements null) and the actors ORG, ORG2, C1, TS and VS. |
| Test Steps | 1. As ORG2, send `POST /api/v1/events/<E1>/change-requests` with the body in Test Data.<br>2. As C1, repeat.<br>3. As TS, repeat.<br>4. As VS, repeat.<br>5. As ORG, send `POST /api/v1/events/00000000-0000-0000-0000-0000000000ff/change-requests` with the same body.<br>6. Count the rows in `change.change_requests` for E1.<br>7. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-T10 '` (or the whole suite) and read the named `S1-T10 ` result. |
| Test Data | `{"reason":"x","changes":{"expectedAttendance":160}}` |
| Expected Result | ORG2: HTTP 404 `EVENT_NOT_FOUND`, because an organiser's access scope is the events they own (A3 `OWNED_BY_USER`), so E1 is outside ORG2's scope and the query returns no row. C1, TS and VS: HTTP 403 `ROLE_NOT_AUTHORISED`, because the route requires the Event Organiser role. ORG on the unknown id: HTTP 404 `EVENT_NOT_FOUND`. There are no `change.change_requests` rows for E1. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-17 |

> **Expected results are checked by the PR reviewer** against S1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S1 implementation and migration change/0001 (CI runs it on the throwaway Postgres). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
