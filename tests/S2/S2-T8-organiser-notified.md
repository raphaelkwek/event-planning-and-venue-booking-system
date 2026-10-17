# S2-T8 — The requesting organiser is notified of either outcome

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T8 |
| Test Scenario | Approval and rejection each put one message in the outbox, and the notification service turns it into one notification for the organiser, naming the event and the fields or the reason |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`).<br>3. The notification service's recipient rule is run on each outbox message, as in `tests/S1/S1-T9-coordinator-notified.md`. A fresh FX-S2 is loaded for the rejection part. |
| Test Steps | 1. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`.<br>2. Read `change.outbox` for E1, then run the notification service's recipient rule on the message and read ORG's notifications.<br>3. On the fresh FX-S2, as C1, send the decision with `{"decision":"REJECT","reason":"No larger hall"}`, then repeat step 2.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T8 '` (or the whole suite) and read the named `S2-T8 ` result. |
| Test Data | As in the steps. |
| Expected Result | After the approval there is exactly one `change-request.approved` message in `change.outbox`, keyed by E1 on the event topic and addressed to ORG; the rule gives ORG one notification containing E1's reference and "start, expected attendance". After the rejection there is exactly one `change-request.rejected` message, likewise keyed and addressed, and ORG gets one notification containing E1's reference and the reason `No larger hall`. No one else is notified. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S2 implementation and migrations change/0002 and change/0003 (CI runs them on the throwaway Postgres). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
