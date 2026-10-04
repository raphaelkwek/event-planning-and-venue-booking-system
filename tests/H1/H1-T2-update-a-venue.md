# H1-T2 — Venue Staff update an existing venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T2 |
| Test Scenario | Venue Staff update an existing venue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues".<br>2. Click "Edit" on `Lee Kong Chian Auditorium`.<br>3. Change Maximum capacity to `320`.<br>4. Add `Livestream camera` as a new line under Facilities.<br>5. Click "Save venue". |
| Test Data | Maximum capacity `320` · New facility `Livestream camera` |
| Expected Result | "Venue saved." is shown. The form shows maximum capacity 320 and four facilities: Projector, Wireless microphones, Stage lighting and Livestream camera. Every other field is unchanged. "Venues" shows the maximum capacity as 320. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Venue saved." was shown; maximum capacity 320 and facilities Projector, Wireless microphones, Stage lighting, Livestream camera; other fields unchanged. Venues showed 320. |
| Status | Pass |
| Remarks | Commit: 56eb0b2 · Evidence: tests/H1/evidence/H1-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
