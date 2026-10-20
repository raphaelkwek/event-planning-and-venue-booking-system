# K2-T10 — A request asking for a facility the venue lacks is not suitable and needs a justification

## Specification

| Item | Content |
|---|---|
| Test Case ID | K2-T10 |
| Test Scenario | A request asking for a facility the venue lacks is not suitable and needs a justification |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the API console and send `POST /venue/api/v1/booking-requests` with the body in Test Data.<br>2. Send it again with `"justification": "Livestream crew brings their own kit."` added. |
| Test Data | Body: `{"eventId": "<event id>", "venueId": "<Lee Kong Chian Auditorium id>", "startsAt": "2026-12-02T14:00:00+08:00", "endsAt": "2026-12-02T18:00:00+08:00", "layout": "Theatre", "expectedAttendance": 150, "facilities": ["Projector", "Livestream"], "accessibilityFeatures": []}` |
| Expected Result | Step 1 returns `422` with code `JUSTIFICATION_REQUIRED`, the message "Lee Kong Chian Auditorium is not suitable for this request. Give a justification to request it anyway.", the field `justification`, and in `details.reasons` one condition, `FACILITIES`, missing `Livestream`, with the message "Required facility absent: Livestream. The venue offers: Projector, Wireless microphones, Stage lighting." Nothing is stored. Step 2 returns `201`, Pending, with `suitabilityStatus` `NOT_SUITABLE`, that condition in `suitabilityReasons`, and the justification. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 1 returned 422 JUSTIFICATION_REQUIRED: "Lee Kong Chian Auditorium is not suitable for this request. Give a justification to request it anyway.", field justification, one condition FACILITIES missing Livestream, message "Required facility absent: Livestream. The venue offers: Projector, Wireless microphones, Stage lighting."; 0 requests stored. Step 2 returned 201, PENDING suitabilityStatus NOT_SUITABLE, the condition and the justification. |
| Status | Pass |
| Remarks | Commit: 1848a1f · Evidence: tests/K2/evidence/K2-T10.png · Environment: local throwaway Postgres + hosted Supabase Auth · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-20 |