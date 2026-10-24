# I6-T2 — A placed hold and a pending request the change makes overlap are each flagged on the calendar, naming the other (partition: hold, pending request)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I6-T2 |
| Test Scenario | A placed hold and a pending request the change makes overlap are each flagged on the calendar, naming the other (partition: hold, pending request) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-OVERLAP's two events, with, instead of the two bookings, a hold placed for `<EVT-1>` at `Lee Kong Chian Auditorium`, 2 December 2026 10:00–12:00 (L3), and a pending request for `<EVT-2>`, 12:15–14:00 (L1); then the turnaround time set to 30 minutes.<br>3. Signed in as the coordinator of `<EVT-2>`. |
| Test Steps | 1. Open the venue's availability and show 2 December 2026.<br>2. Read the hold's and the request's rows. |
| Test Data | Hold 10:00–12:00, request 12:15–14:00 |
| Expected Result | The hold's row reads "Held `<EVT-1>`" and names the request's reference; the request's row reads "Pending `<EVT-2>`" and names the hold's reference. Both are flagged Requires reconfirmation. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The hold's row read "10:00–12:00 Held EVT-014306 Requires reconfirmation: overlaps BKR-004873 (EVT-014307) with the venue's setup and turnaround time"; the request's row read "12:15–14:00 Pending EVT-014307 Requires reconfirmation: overlaps HLD-000833 (EVT-014306) with the venue's setup and turnaround time". |
| Status | Pass |
| Remarks | Commit: e541b51 · Evidence: tests/I6/evidence/I6-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
