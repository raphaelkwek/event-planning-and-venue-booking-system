# S2-T11 — Simultaneous approve and reject: exactly one decision is recorded

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T11 |
| Test Scenario | Fifty simultaneous decisions on one pending request, half approve and half reject, ten rounds, leave exactly one decision |
| Pre-conditions | 1. A throwaway Postgres on CI's runner with every migration applied. The test skips itself anywhere else, and never runs against the shared database (EN-06).<br>2. One pending request on an Approved event, created fresh for each round. |
| Test Steps | 1. Send 50 decisions at once for the one request as its assigned coordinator, 25 `APPROVE` and 25 `REJECT` (reason `Race`).<br>2. Count the fulfilled and refused results, then read the request and the event's history.<br>3. Repeat for 10 rounds.<br>4. CI runs `tests/race/invariants.test.ts`; read the S2 race result there. It does not run locally. |
| Test Data | As in the steps. |
| Expected Result | In each round exactly one call is fulfilled and every other returns `CHANGE_REQUEST_ALREADY_DECIDED`. The request has exactly one decision. FIELD_CHANGE entries exist for the event only if that decision was APPROVE, and then exactly one per changed field. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S2 implementation; runs on CI's throwaway Postgres only (`tests/race/invariants.test.ts`). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
