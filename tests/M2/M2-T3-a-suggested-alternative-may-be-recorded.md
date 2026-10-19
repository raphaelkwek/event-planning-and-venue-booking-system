# M2-T3 — Suggested alternative dates or venues may be recorded with the rejection, and the coordinator sees them

## Specification

| Item | Content |
|---|---|
| Test Case ID | M2-T3 |
| Test Scenario | Suggested alternative dates or venues may be recorded with the rejection, and the coordinator sees them |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>4. Signed in as `venuestaff@connectsphere.test`, on "Booking requests". |
| Test Steps | 1. Click "Reject", type the reason and the suggestion in Test Data, and click "Reject request".<br>2. Sign out, sign in as the assigned coordinator, and open the event's "Venue requests". |
| Test Data | Reason `Already promised to another faculty` · Suggested alternative `Thursday 3 December at the same time, or Seminar Room 2-1` |
| Expected Result | The coordinator's list shows the request Rejected, with the reason and the suggested alternative. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The coordinator's row read "BKR-000399Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150RejectedReason: Already promised to another facultySuggested alternative: Thursday 3 December at the same time, or Seminar Room 2-1". |
| Status | Pass |
| Remarks | Commit: 9adf0ff · Evidence: tests/M2/evidence/M2-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
