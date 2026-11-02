# A4-T6 — A coordinator not assigned to an event cannot request a venue (L1, L4, L5) or a hold (L3) for it

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T6 |
| Test Scenario | A coordinator not assigned to an event cannot request a venue (L1, L4, L5) or a hold (L3) for it |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C2, send `POST /api/v1/booking-requests` for E2 at V1, with L1's standard body (`tests/L1/README.md`).<br>2. Repeat step 1 for V2, as a second venue for the event (L4).<br>3. Repeat step 1 with `replacesBookingId` set to BR1's id (L5).<br>4. As C2, send `POST /api/v1/holds` for E2 at V1.<br>5. Count E2's booking requests, holds and slots.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T6 '` and read the named `A4-T6 ` result. |
| Test Data | Actor C2. E2 (Approved, assigned to C1), V1, V2, BR1. |
| Expected Result | Each request answers HTTP 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you." E2 still has exactly BR1 and H1, no slot has been added, and the venue outbox reads exactly as before. VS receives no notification. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | All four answered 404 EVENT_NOT_FOUND "No event with that reference is assigned to you.". E2 still had only BR1 and H1, no slot was added, and every outbox was unchanged. |
| Status | Pass |
| Remarks | Commit: a1ceeae, automated (`tests/event/api/a4Cards.test.ts`), on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via Claude |
| Date of Execution | 2026-11-02 |
