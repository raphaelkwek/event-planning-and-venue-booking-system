# M2-T2 — On rejection the request becomes Rejected, and the reason, the Venue Staff member and the time are recorded and shown to the requesting coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | M2-T2 |
| Test Scenario | On rejection the request becomes Rejected, and the reason, the Venue Staff member and the time are recorded and shown to the requesting coordinator |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00. Note its booking reference.<br>4. Signed in as `venuestaff@connectsphere.test`, on "Booking requests". |
| Test Steps | 1. Click "Reject" on the request, type the reason in Test Data, and click "Reject request".<br>2. In the SQL editor, read the request's status, reason, `decided_by` and `decided_at`.<br>3. Sign out, sign in as the assigned coordinator, and open the event's "Venue requests". |
| Test Data | Account: `venuestaff@connectsphere.test`, then the assigned coordinator · Reason `The auditorium is closed for exams that week` |
| Expected Result | "BKR-… rejected." is shown and the request leaves the queue. It is `REJECTED`, with the reason, decided by `00000000-0000-0000-0000-000000000003` within the last minute. The coordinator's list shows it Rejected, with the reason. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The request became Rejected with the reason, decider and time; the coordinator's Venue requests showed Rejected and the reason. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/l-bookings.spec.ts › M2-T2 a rejection records the reason, who and when, and the coordinator sees it, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
