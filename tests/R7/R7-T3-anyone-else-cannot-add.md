# R7-T3 — Negative: another organiser, an unassigned coordinator and an attendee cannot add an attendee, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T3 |
| Test Scenario | Negative: another organiser, an unassigned coordinator and an attendee cannot add an attendee, and nothing is stored |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with its defaults, then FX-R-MANAGED. |
| Test Steps | 1. Through the API console, as `organiser2@connectsphere.test`, `POST /registration/api/v1/events/<EVENT_ID>/manual-registrations` with `{"attendeeEmail": "attendee@connectsphere.test"}`.<br>2. The same as `coordinator2@connectsphere.test`.<br>3. The same as `attendee@connectsphere.test`. |
| Test Data | Organiser Two, Coordinator Two, Attendee One |
| Expected Result | Steps 1 and 2: 404 `EVENT_NOT_FOUND` (the event is not shown to them). Step 3: 403 `ROLE_NOT_AUTHORISED`. No registration exists for the event. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
