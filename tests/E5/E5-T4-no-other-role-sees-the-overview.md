# E5-T4 — No other role can see the overview or an event's assignment history (A2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | E5-T4 |
| Test Scenario | No other role can see the overview or an event's assignment history (A2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-UNDER-REVIEW completed. Note its id. |
| Test Steps | 1. As each of `coordinator@`, `organiser@`, `venuestaff@`, `techsupport@` and `attendee@connectsphere.test`, look for "Assignments" in the navigation and open `#/assignments`.<br>2. As each, send `GET /api/v1/assignments` and `GET /api/v1/events/<id>/assignments` through the API console. |
| Test Data | Five accounts |
| Expected Result | No account but the Lead has "Assignments" in its navigation or is shown the list, and every request is refused as not authorised. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | coordinator: no link, no list, API 403/403; organiser: no link, no list, API 403/403; venuestaff: no link, no list, API 403/403; techsupport: no link, no list, API 403/403; attendee: no link, no list, API 403/403. |
| Status | Pass |
| Remarks | Commit: 742bee5 · Evidence: tests/E5/evidence/E5-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-28 |
