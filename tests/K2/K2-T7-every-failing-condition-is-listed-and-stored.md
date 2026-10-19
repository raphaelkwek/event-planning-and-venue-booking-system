# K2-T7 — Several failing conditions are each listed, and each stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T7 |
| Test Scenario | Several failing conditions are each listed, and each stored |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator, on the event's "Request a venue" form (the event → "Venue requests" → "Request a venue"). |
| Test Steps | 1. Choose Venue `Lee Kong Chian Auditorium` and Room layout `Classroom`, set End time `23:00`, and click "Submit request".<br>2. Type `Evening keynote overruns; the hall staff agreed.` in the Justification box and click "Submit request".<br>3. In the SQL editor, run the query in Test Data. |
| Test Data | Query: `select suitability_reasons from venue.booking_requests where event_id = '<event id>';` |
| Expected Result | After step 1 the form lists two failing conditions, in this order: "Expected attendance 150 against layout capacity 120 (Classroom)." and "The requested period 2026-12-02 14:00–23:00 is outside Wednesday's operating hours 08:00–22:00." Step 2 creates the request, Pending. Step 3 returns one row whose reasons are those two conditions, `LAYOUT_CAPACITY` then `OPERATING_HOURS`. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | |
| Executed By | |
| Date of Execution | |
