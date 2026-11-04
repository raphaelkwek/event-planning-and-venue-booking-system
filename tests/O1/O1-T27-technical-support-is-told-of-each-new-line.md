# O1-T27 — Technical Support is told of each new equipment line

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T27 |
| Test Scenario | Every active Technical Support Staff member is told of each equipment request line a coordinator saves (team decision D-02, `documentation/clarifications.md`) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded.<br>3. Users in `identity.users` with their roles: TS (`TECH_SUPPORT_STAFF`, active) and RETIRED_TS (`TECH_SUPPORT_STAFF`, deactivated). |
| Test Steps | 1. As C1, save the two lines of O1-T2 (CHAIRS × 40 and PROJECTORS × 2) with `POST /api/v1/equipment/request-lines`.<br>2. Read the equipment outbox for each new line (`select envelope from equipment.outbox where message_key = '<line id>'`).<br>3. Pass each stored message through the notification service's recipient rule (`notificationsFor`).<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T27 '` (or the whole suite) and read the named `O1-T27 ` result. |
| Test Data | The body of O1-T2. |
| Expected Result | HTTP 201 with both lines. Each line has one `equipment-request.line-submitted` message on `connectsphere.equipment-request.v1`, keyed by the line, naming the event, the equipment type, the quantity and the required period, with TS in `technicalSupportIds` and not RETIRED_TS. The recipient rule tells TS once per line, e.g. "New equipment request for `<reference>` “O1 fixture event”: O1 Folding Chairs × 40, needed `<day>, <from>–<to>`. It is waiting in your Equipment requests list.", and nobody else: not C1, not ORG, not RETIRED_TS. A refused save (O1-T10) writes no message. |
| Created By | Joash |
| Date of Creation | 2026-11-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
