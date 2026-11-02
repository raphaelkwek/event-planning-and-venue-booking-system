# U1-T10 — After rework the event passes confirmation and the safety check again

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T10 |
| Test Scenario | After rework the event passes confirmation and the safety check again |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded).<br>3. SO requested changes on E1 (U1-T7), so E1 is Planning with B1 and R1 flagged. |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` (F5) and read the refusal.<br>2. Clear the two flags as Venue Staff and Technical Support would (set directly in the fixture).<br>3. As C1, send F5 again, then as SO read the queue.<br>4. As C1, send `POST /api/v1/events/<E1>/mark-confirmed`. |
| Test Data | Actors C1, SO. |
| Expected Result | F5 is refused while the flags are outstanding and succeeds once they are clear. E1 is back in the queue, and the earlier decision does not count: Mark Confirmed is refused with `SAFETY_CHECK_NOT_PASSED` until SO decides again. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | F5 was refused with 422 ARRANGEMENTS_NOT_READY while the flags stood and succeeded once they were cleared; E1 returned to the queue with no decision; Mark Confirmed was refused with SAFETY_CHECK_NOT_PASSED until SO approved again, then succeeded; both decisions were kept. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 042f2d5 · Evidence: backend/services/planning-core/tests/change/api/u1Cards.test.ts › U1-T10 after rework the event passes confirmation and the safety check again, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839 · Defect: — (that run's integration job fails only on tests/race/invariants.test.ts L3-T17, a fixed-date test outside U1; every U1 card passed) |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
