# Q2-T9 — The coordinator is notified of every release

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T9 |
| Test Scenario | A release, by Technical Support or by the coordinator's own removal, tells the assigned coordinator, and the message is worded as a release |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q2 from `tests/Q2/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), the actors TS, C1, ORG, VS and ATT, and line L1 (CHAIRS × 4 for E1, Confirmed, then reserved by TS through `POST /api/v1/equipment/request-lines/<L1>/reservation`, leaving 6 CHAIRS). |
| Test Steps | 1. As TS, release L1 as in Q2-T1, then read the outbox messages for L1.<br>2. Pass each `equipment-request.line-status-changed` message through the notification service's recipient rule and read C1's notifications.<br>3. Reload FX-Q2 afresh. As C1, remove L1 as in Q2-T8, then read the outbox messages and C1's notifications the same way.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-T9 '` (or the whole suite) and read the named `Q2-T9 ` result. |
| Test Data | Q2-T1's release on L1; separately, C1's removal of L1 |
| Expected Result | Each action writes one `equipment-request.line-status-changed` outbox message for the line with coordinatorId C1 and `released: true`. Each gives C1 one notification whose text contains E1's reference, the equipment name, "released" and the reason. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks |  |
| Executed By | |
| Date of Execution | |
