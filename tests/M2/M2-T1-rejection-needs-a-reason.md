# M2-T1 — Boundary: rejection requires a reason of at least one non-whitespace character; without it the request stays Pending with no rejection time

## Specification

| Item | Content |
|---|---|
| Test Case ID | M2-T1 |
| Test Scenario | Boundary: rejection requires a reason of at least one non-whitespace character; without it the request stays Pending with no rejection time |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>4. Signed in as `venuestaff@connectsphere.test`, on "Booking requests". |
| Test Steps | 1. Click "Reject" on the request, leave Reason empty and click "Reject request".<br>2. Type three spaces in Reason and click "Reject request".<br>3. Type `X` in Reason and click "Reject request".<br>4. In the SQL editor, read the request's status, reason and `decided_at` after each step. |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | Steps 1 and 2 show, under Reason, that a reason is required; the request stays `PENDING` with no `decided_at`. Step 3 rejects it with reason `X`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Empty and blank reasons were refused with the request still Pending and no decision time; a one-character reason rejected it. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/l-bookings.spec.ts › M2-T1 rejection needs a reason with at least one non-whitespace character, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
