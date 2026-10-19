# L1-T10 — CR-02: a request raised to replace a disrupted booking is linked to that booking

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T10 |
| Test Scenario | CR-02: a request raised to replace a disrupted booking is linked to that booking |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. FX-DISRUPTED completed (`tests/L1/README.md`): the event has a confirmed booking at `Seminar Room 2-1` flagged Requires Reconfirmation. Note its id.<br>4. Signed in as the assigned coordinator. |
| Test Steps | 1. Open the API console and send `POST /venue/api/v1/booking-requests` with the body in Test Data.<br>2. Send it again with `replacesBookingId` set to a random id, `00000000-0000-0000-0000-00000000dead`, and `venueId` of `Seminar Room 2-1`. |
| Test Data | Body: `{"eventId": "<event id>", "venueId": "<Lee Kong Chian Auditorium id>", "startsAt": "2026-12-02T14:00:00+08:00", "endsAt": "2026-12-02T18:00:00+08:00", "layout": "Theatre", "expectedAttendance": 150, "facilities": [], "accessibilityFeatures": [], "replacesBookingId": "<flagged booking id>"}` (L5 adds the screen for this) |
| Expected Result | Step 1 returns `201` with the new request Pending and `replacesBookingId` set to the flagged booking's id; the flagged booking is unchanged. Step 2 returns `422`, saying the booking to replace must be one of this event's confirmed bookings flagged Requires Reconfirmation, and stores nothing. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 1 returned 201, Pending, with replacesBookingId fd18dfb2-4c1b-4712-b1d8-bcd50525c126; the flagged booking stayed Confirmed and flagged. Step 2 returned 422 REPLACEMENT_NOT_VALID: "The booking to replace must be one of this event's confirmed bookings flagged Requires Reconfirmation." Nothing was stored for it. |
| Status | Pass |
| Remarks | Commit: 73c1d60 · Evidence: tests/L1/evidence/L1-T10.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
