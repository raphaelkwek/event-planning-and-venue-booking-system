# E2-T8 — The nominee has no coordinator actions while the proposal is pending

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T8 |
| Test Scenario | While a reassignment proposal is pending, the nominee does not gain coordinator actions on the event until they accept — this is specific to E2's handshake, not a generic role check |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed. |
| Test Steps | 1. Sign in as the nominee coordinator (not yet accepted).<br>2. Open the request from the review queue.<br>3. Note whether "Approve"/"Reject" are enabled.<br>4. Attempt `POST /event/api/v1/events/<id>/reassignment-proposals/accept` as the *outgoing* coordinator instead of the nominee, via the API console. |
| Test Data | — |
| Expected Result | Accept/decline of the reassignment itself is nominee-only: the outgoing coordinator's own attempt to accept returns `404 REASSIGNMENT_PROPOSAL_NOT_FOUND`. **Known gap against the AC's literal wording**, flagged rather than silently built around (implementation.md §11 rule 4): D1/D4/D5 already let *any* `EVENT_COORDINATOR` approve, reject, or ask for clarification on a Submitted/Under-Review request — that authorization was never scoped to "the assigned coordinator" for those actions, so the nominee (like any other coordinator) can already Approve/Reject before accepting the reassignment. Restricting D4/D5 to the assigned coordinator only would be a change to D1's existing open-queue review model, outside E2's stated scope, and is not made here — raised for the story owner to confirm whether it's acceptable or needs a follow-up story. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
