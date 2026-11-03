# F3-T6 — A cancelled event refuses an edit, a change request, a venue request, a hold, equipment lines and a reservation

## Specification

| Item | Content |
|---|---|
| Test Case ID | F3-T6 |
| Test Scenario | Once cancelled, E can't be edited and no new booking, hold, equipment request, reservation or change request can be raised against it |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`), using the isolated setup in `tests/F3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F3 from `tests/F3/README.md` is loaded. Specific set-up: E also has a second Confirmed equipment line L2 that is not reserved. |
| Test Steps | 1. As O, cancel E.<br>2. As O, send `PATCH /api/v1/events/<E>` with `{"purpose":"Too late"}` and E's current version in `If-Match`.<br>3. As O, send `POST /api/v1/events/<E>/change-requests` with `{"reason":"x","changes":{"expectedAttendance":170}}`.<br>4. As C, send `POST /api/v1/booking-requests` for E at V1, E's period, layout Theatre, attendance 150.<br>5. As C, send `POST /api/v1/holds` for E at V1, E's period.<br>6. As C, send `POST /api/v1/equipment/request-lines` for E with one line of chairs × 1.<br>7. As T, send `POST /api/v1/equipment/request-lines/<L2>/reservation` with `{}`.<br>8. Compare E and its arrangements with after step 1.<br>9. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-T6 '` and read the named `F3-T6 ` result. |
| Test Data | As in the steps. |
| Expected Result | Step 2 answers 409 `EVENT_NOT_EDITABLE`; step 3 409 `EVENT_NOT_CHANGEABLE`; step 4 409 `EVENT_NOT_BOOKABLE`; step 5 409 `EVENT_NOT_HOLDABLE`; steps 6 and 7 409 `EVENT_CANCELLED` "This event has been cancelled, so no equipment can be requested or reserved for it." Step 8 finds nothing changed. (No registration can be raised: EN-13's registration service does not exist yet.) |
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
