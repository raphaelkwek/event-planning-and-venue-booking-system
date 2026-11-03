# A4-T8 — The assigned coordinator still performs each coordinator action on their own events

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T8 |
| Test Scenario | The assigned coordinator still performs each coordinator action on their own events |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/clarifications` with `{"message":"Please confirm the expected attendance."}`.<br>2. As C1, send `PATCH /api/v1/events/<E2>` with `If-Match` and `{"purpose":"Share faculty research across schools"}`.<br>3. As C1, send `POST /api/v1/equipment/request-lines` with `{"eventId":"<E2>","lines":[{"equipmentTypeId":"<A4 Chairs>","quantity":2}]}`.<br>4. As C1, send `POST /api/v1/holds/<H1>/release`.<br>5. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"REJECT","reason":"Attendance stays at 150."}`.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T8 '` and read the named `A4-T8 ` result. |
| Test Data | Actor C1. E1, E2, H1, CR1 of FX-A4. |
| Expected Result | Step 1: 201, E1 becomes Awaiting Clarification. Step 2: 200, E2's purpose is the new value. Step 3: 201, a second line is recorded. Step 4: 200, H1 is Released. Step 5: 200, CR1 is Rejected with the reason. None is refused for assignment. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | D2 201 (E1 Awaiting Clarification), G1 200 (new purpose), O1 201 (a second line), hold release 200 (Released), change decision 200 (Rejected). None was refused. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: c944c5e · Evidence: `backend/services/planning-core/tests/event/api/a4Cards.test.ts` › A4 cards (tests/A4) › A4-T8 the assigned coordinator still performs each coordinator action on their own events, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41598779764 · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
