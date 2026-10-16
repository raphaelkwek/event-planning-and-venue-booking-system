# Q1-T1 — Technical Support reserves a Confirmed bulk line

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T1 |
| Test Scenario | Reserving a Confirmed bulk line records every field of the reservation, sets the line to Reserved and lowers availability by exactly the quantity reserved |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. A CHAIRS line (quantity 4, Confirmed) for E1. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data.<br>2. As TS, send `GET /api/v1/equipment/request-lines/<id>`.<br>3. As TS, send `GET /api/v1/equipment/types/<CHAIRS>/availability` for E1's window with requestedQuantity 1.<br>4. As TS, repeat the availability request for a window overlapping only E1's last hour.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T1 '` (or the whole suite) and read the named `Q1-T1 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 201. The reservation has eventId E1, E1's reference, equipment type CHAIRS, kind `BULK`, requestedQuantity 4, reservedQuantity 4, startsAt and endsAt equal to the line's window, reservedBy TS and reservedAt between the instants around the request. The line status is `RESERVED` and statusChangedBy is TS. The availability for E1's window shows availableQuantity 6, and for the window overlapping only the last hour also 6. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-15 |

> **Expected results are checked by the PR reviewer** against Q1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: 870e3e7698d5c97b6118ef69fcaa08c2540da429 · Evidence: backend/services/planning-core/tests/equipment/api/q1Cards.test.ts › Q1-T1, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38786048236 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-16 |
