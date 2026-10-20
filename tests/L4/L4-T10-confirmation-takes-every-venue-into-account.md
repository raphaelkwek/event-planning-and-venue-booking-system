# L4-T10 — Confirming the arrangements takes every venue into account (F5, CQ-05)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T10 |
| Test Scenario | Confirming the arrangements takes every venue into account (F5, CQ-05) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, its event marked as needing no equipment.<br>3. A confirmed booking at `Lee Kong Chian Auditorium`, and a pending request for `Seminar Room 2-1`, Classroom, 40, both 14:00–18:00.<br>4. Signed in as FX-BOOKING's coordinator. |
| Test Steps | 1. Open the event and click "Confirm arrangements".<br>2. As `venuestaff@`, approve the `Seminar Room 2-1` request.<br>3. As the coordinator, click "Confirm arrangements" again. |
| Test Data | Two venues; one confirmed, then both |
| Expected Result | Step 1 is refused, naming the `Seminar Room 2-1` request as outstanding. Step 3 succeeds and the event moves to Safety Review. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

> F5-T8 and F5-T9 test the rule through the API. CQ-05 (must every booking be confirmed?) is open; this follows F5 as written.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
