# Q1-T10 — Reserving is recorded and the coordinator is notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T10 |
| Test Scenario | The reservation adds a history entry and an outbox message from which the assigned coordinator is notified |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. A CHAIRS line (quantity 4, Confirmed) for E1; the outbox is empty for this line. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data.<br>2. Read the line's history and its rows in `equipment.outbox`.<br>3. Pass the stored CloudEvent through the notification service's recipient rule.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T10 '` (or the whole suite) and read the named `Q1-T10 ` result. |
| Test Data | `{}` |
| Expected Result | The line's history ends with a `STATUS_CHANGED` entry from `CONFIRMED` to `RESERVED` by TS whose `details` are `{reservationId, equipmentTypeId: CHAIRS, equipmentTypeName: "CHAIRS", requestedQuantity: 4, reservedQuantity: 4}`. The equipment outbox has one `equipment-request.line-status-changed` message for the line with coordinatorId C1 and newStatus `RESERVED`. The recipient rule produces one notification for C1 whose text contains E1's reference. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-15 |

> **Expected results are checked by the PR reviewer** against Q1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
