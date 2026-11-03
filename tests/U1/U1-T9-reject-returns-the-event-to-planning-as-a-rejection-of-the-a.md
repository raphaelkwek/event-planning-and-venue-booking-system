# U1-T9 — Reject returns the event to Planning as a rejection of the arrangement as a whole

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T9 |
| Test Scenario | Reject returns the event to Planning as a rejection of the arrangement as a whole |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded). |
| Test Steps | 1. As SO, send `POST /api/v1/events/<E1>/safety-decision` with decision `REJECT` and the reason `The venue cannot hold this crowd safely`.<br>2. Read the event, its latest status history entry, `event.safety_decisions`, the arrangements' flags and the outbox with the queries in `tests/U1/README.md`. |
| Test Data | Actor SO. |
| Expected Result | HTTP 201. E1 is Planning, not Rejected or Cancelled. The decision row records `REJECT`, flagging nothing by name. B1 is still Confirmed and R1 still Reserved, unflagged. The history entry reads Safety Review to Planning, `REJECT_SAFETY_ARRANGEMENT`. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | The rejection returned 201; E1 was Planning, not Rejected or Cancelled; the decision row recorded REJECT with nothing flagged; B1 stayed Confirmed and R1 Reserved, unflagged; the history entry read Safety Review to Planning, REJECT_SAFETY_ARRANGEMENT. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 042f2d5 · Evidence: backend/services/planning-core/tests/change/api/u1Cards.test.ts › U1-T9 reject returns the event to Planning as a rejection of the arrangement as a whole, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839 · Defect: — (that run's integration job fails only on tests/race/invariants.test.ts L3-T17, a fixed-date test outside U1; every U1 card passed) |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
