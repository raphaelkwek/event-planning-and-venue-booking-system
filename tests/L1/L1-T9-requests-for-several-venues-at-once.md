# L1-T9 — CR-03: an event can have requests for several venues at the same time, and each is decided separately

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T9 |
| Test Scenario | CR-03: an event can have requests for several venues at the same time, and each is decided separately |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Request `Lee Kong Chian Auditorium` (Theatre) with the event's times.<br>2. Request `Seminar Room 2-1` (Classroom) with the same times.<br>3. On "Venue requests", withdraw the `Seminar Room 2-1` request (L2). |
| Test Data | Account: the assigned coordinator · Both requests are for 2 December 2026, 14:00–18:00 |
| Expected Result | Both requests are accepted and listed, each Pending with its own booking reference. After step 3, `Seminar Room 2-1`'s request is Withdrawn and `Lee Kong Chian Auditorium`'s is still Pending. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both were accepted, BKR-000419 (Lee Kong Chian Auditorium) and BKR-000420 (Seminar Room 2-1), each Pending. After withdrawing BKR-000420: "BKR-000420Seminar Room 2-1Wednesday 2 December 2026, 14:00–18:00Classroom150Withdrawn"; BKR-000419 was still Pending. |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T9.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
