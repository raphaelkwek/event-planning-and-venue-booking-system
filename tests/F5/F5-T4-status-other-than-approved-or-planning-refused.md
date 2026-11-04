# F5-T4 — Every status other than Approved and Planning is refused, naming the current status and Safety Review; a Draft is not revealed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F5-T4 |
| Test Scenario | Every status other than Approved and Planning is refused, naming the current status and Safety Review; a Draft is not revealed |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-F5 from `tests/F5/README.md`: event E1 (Approved, owned by ORG, assigned to C1, `D 14:00`–`D 18:00` UTC, equipment required), booking B1 (Confirmed, V1 `F5 Hall`, looked after by VS) and line L1 (`F5 Chairs` × 5, reserved 5 of 5 by TS), repeated once per status in Test Data, with E1's status set to that status. |
| Test Steps | 1. As C1, send `POST /api/v1/events/<E1>/confirmation` with no body. Repeat for each status in Test Data.<br>2. Read the event, latest history entry, arrangements and outbox with the queries in `tests/F5/README.md`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-T4 '` and read the named `F5-T4 ` result. |
| Test Data | Statuses: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `AWAITING_CLARIFICATION`, `SAFETY_REVIEW`, `CONFIRMED`, `COMPLETED`, `CANCELLED`, `REJECTED`. |
| Expected Result | For `DRAFT`: HTTP 404 `EVENT_NOT_FOUND` ("No event with that reference is assigned to you."), because a draft is private to its organiser (C1, A3) and a coordinator never learns it exists. For each other status: HTTP 409 `STATUS_TRANSITION_NOT_PERMITTED`, with the message "This event is <label> and cannot move to Safety Review." (e.g. "This event is Under Review and cannot move to Safety Review."). Nothing written: E1's status, its history, its slots' status and flags, its reservations and the event outbox read exactly as before. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-10-20 |

> **Revised 2026-10-20, before the card was first passed:** the expected result for `DRAFT` was 409. A3's scope
> rule (C1: a draft is visible only to its owner) makes it 404, as for any event outside the caller's scope. The
> other eight statuses are unchanged.

> **Expected results are checked by the story owner** against F5's acceptance criteria before the code
> is written (implementation.md §11.12).

> **Revised for A4 (CR-05) on 4 Nov 2026.** A coordinator's 404 now says the event is not assigned to them (A4 AC1), the same
> words whether it exists or not, so the `DRAFT` message reads "No event with that reference is assigned to you." in place of
> "... is available to you.". The 404 `EVENT_NOT_FOUND` and the other eight statuses are unchanged.

## Execution record

| Item | Content |
|---|---|
| Actual Result | For DRAFT, C1 got 404 EVENT_NOT_FOUND "No event with that reference is assigned to you." (A4's wording; the card is revised for CR-05). For SUBMITTED, UNDER_REVIEW, AWAITING_CLARIFICATION, SAFETY_REVIEW, CONFIRMED, COMPLETED, CANCELLED and REJECTED, each on a fresh FX-F5, C1 got 409 STATUS_TRANSITION_NOT_PERMITTED with "This event is <label> and cannot move to Safety Review." (Submitted, Under Review, Awaiting Clarification, Safety Review, Confirmed, Completed, Cancelled, Rejected). Each time E1's status and version, its history (entry count and the latest STATUS_CHANGE entry), its slots' status and flags (requires_reconfirmation, period_mismatch, unsuitable, and their arrangement_flags rows), its booking requests, its request lines, its reservations (status and quantity) and the event outbox (row count and every envelope) read exactly as before the request. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: c0f7183 · Evidence: `backend/services/planning-core/tests/change/api/f5Cards.test.ts` › F5 cards (tests/F5) › F5-T4 every status but Approved and Planning is refused, naming it and Safety Review, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
