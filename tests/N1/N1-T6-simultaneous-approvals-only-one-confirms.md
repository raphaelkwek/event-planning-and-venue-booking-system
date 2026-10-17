# N1-T6 — Confirmation is atomic: when two approvals for overlapping periods at the same venue happen at the same moment, exactly one confirms and the other is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | N1-T6 |
| Test Scenario | Confirmation is atomic: when two approvals for overlapping periods at the same venue happen at the same moment, exactly one confirms and the other is refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, and the N1 second event statement run (`tests/N1/README.md`), which gives the same coordinator a second Approved event.<br>3. The coordinator has requested `Lee Kong Chian Auditorium`, Theatre, for both events: the first 14:00–18:00, the second 16:00–20:00. Note both booking references.<br>4. Two windows signed in as `venuestaff@connectsphere.test`, each on "Booking requests". |
| Test Steps | 1. Click "Approve" on the first request in one window and on the second in the other, and then "Approve request" in both windows at the same moment.<br>2. In the SQL editor, list the venue's confirmed bookings on 2 December 2026, and both requests' statuses. |
| Test Data | Account: `venuestaff@connectsphere.test` (two windows) · 14:00–18:00 and 16:00–20:00 overlap from 16:00 to 18:00 · The automated runner sends both approvals at once |
| Expected Result | Exactly one window shows its request approved. The other shows a refusal naming the winning event's reference and period. There is exactly one confirmed booking for the venue that day; the winning request is `APPROVED` and the other is still `PENDING`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
