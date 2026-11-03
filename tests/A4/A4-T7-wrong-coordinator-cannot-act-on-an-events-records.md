# A4-T7 — A coordinator not assigned to an event cannot withdraw its booking requests, release or convert its holds, change its equipment lines or decide its change requests (L2, L3, L6, O1, S2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T7 |
| Test Scenario | A coordinator not assigned to an event cannot withdraw its booking requests, release or convert its holds, change its equipment lines or decide its change requests (L2, L3, L6, O1, S2) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C2, send `POST /api/v1/booking-requests/<BR1>/withdraw`.<br>2. As C2, send `POST /api/v1/holds/<H1>/release`, then `POST /api/v1/holds/<H1>/convert`.<br>3. As C2, send `PUT /api/v1/equipment/request-lines/<EL1>` with `{"quantity":3}`, then `POST /api/v1/equipment/request-lines/<EL1>/removal`.<br>4. As C2, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`.<br>5. Repeat steps 1 to 4 with a fresh random UUID in place of each id.<br>6. Read BR1, H1, EL1, CR1 and E2.<br>7. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T7 '` and read the named `A4-T7 ` result. |
| Test Data | Actor C2. BR1, H1, EL1, CR1 (all on E2, assigned to C1); fresh random UUIDs. |
| Expected Result | Each request answers HTTP 404 with the record's code and message from the table in `tests/A4/README.md` (for example `BOOKING_REQUEST_NOT_FOUND`, "No booking request with that id is on an event assigned to you."). A random id gets exactly the same answer as the real one. BR1 is still Pending, H1 still Requested, EL1 still `A4 Chairs` × 5, CR1 still Pending, and E2's expected attendance unchanged. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Every request answered 404 with the record's code and A4's message from the README, and a random id got exactly the same answer. BR1, H1, EL1 and CR1 were unchanged. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: c944c5e · Evidence: `backend/services/planning-core/tests/event/api/a4Cards.test.ts` › A4 cards (tests/A4) › A4-T7 a coordinator not assigned to an event cannot act on its booking requests, holds, equipment lines or change requests (L2, L3, L6, O1, S2), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41598779764 · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
