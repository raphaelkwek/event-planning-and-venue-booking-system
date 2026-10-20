# K2-T9 — A justification sent with a suitable request is not stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T9 |
| Test Scenario | A justification sent with a suitable request is not stored |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the API console and send `POST /venue/api/v1/booking-requests` with the body in Test Data.<br>2. In the SQL editor, run `select suitability_status, unsuitable_justification from venue.booking_requests where event_id = '<event id>';`. |
| Test Data | Body: `{"eventId": "<event id>", "venueId": "<Lee Kong Chian Auditorium id>", "startsAt": "2026-12-02T14:00:00+08:00", "endsAt": "2026-12-02T18:00:00+08:00", "layout": "Theatre", "expectedAttendance": 150, "facilities": [], "accessibilityFeatures": [], "justification": "Just in case."}` |
| Expected Result | Step 1 returns `201` with `suitabilityStatus` `SUITABLE`, `suitabilityReasons` `[]` and `justification` `null`. Step 2 returns `SUITABLE` and a null justification. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 1 returned 201 with suitabilityStatus SUITABLE, suitabilityReasons [] and justification null. Step 2 returned SUITABLE and a null justification. |
| Status | Pass |
| Remarks | Commit: 1848a1f · Evidence: tests/K2/evidence/K2-T9.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |