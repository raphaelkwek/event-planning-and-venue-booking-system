# I5-T7 — Removing an open-ended block records who and when, restores availability and clears the flags it set

## Specification

| Item | Content |
|---|---|
| Test Case ID | I5-T7 |
| Test Scenario | Removing an open-ended block records who and when, restores availability and clears the flags it set |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. I5-T3's pre-conditions completed, and its block recorded and confirmed.<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. On `Lee Kong Chian Auditorium`'s Unavailability page, click "Remove" on the open-ended block and confirm.<br>2. In the SQL editor, read the block's status, who removed it and when, and the bookings' and request's flags.<br>3. As the coordinator, request `Lee Kong Chian Auditorium`, Theatre, 150, 20 December 2026 14:00–18:00. |
| Test Data | Remove the block |
| Expected Result | The block is `REMOVED` with who and when. The flags it set are cleared. The request for 20 December is accepted. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
