# M1-T3 — Approval sets the request Approved, creates a confirmed booking for the venue and period, and records the approving Venue Staff member and the time

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T3 |
| Test Scenario | Approval sets the request Approved, creates a confirmed booking for the venue and period, and records the approving Venue Staff member and the time |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00. Note its booking reference.<br>4. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests", then "Approve" on the request.<br>2. Read the dialog, then click "Approve request".<br>3. In the SQL editor, read the request's status, `decided_by`, `decided_at` and `booking_id`, and that booking's status, venue and times. |
| Test Data | Account: `venuestaff@connectsphere.test` (user id `00000000-0000-0000-0000-000000000003`) |
| Expected Result | The dialog names the booking reference, the venue and the period. Afterwards "BKR-… approved. The booking is confirmed." is shown and the request leaves the queue. In the database the request is `APPROVED`, decided by `00000000-0000-0000-0000-000000000003` within the last minute, and its booking is `CONFIRMED` at `Lee Kong Chian Auditorium`, 2 December 2026 14:00–18:00. |
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
