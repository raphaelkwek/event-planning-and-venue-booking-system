# S3-T14 — A pending request flagged at approval stays flagged once M1 confirms it

## Specification

| Item | Content |
|---|---|
| Test Case ID | S3-T14 |
| Test Scenario | A booking request still pending when a date change is approved is flagged `REQUIRES_RECONFIRMATION`; when Venue Staff then approve it (M1), the confirmed booking carries the flag and its reason, and F5 still refuses |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), using the isolated setup in `tests/S3/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S3 from `tests/S3/README.md` is loaded. Specific set-up: a third venue V3 `Venue Three` (layout "Theatre", capacity 100, looked after by VS) and C's Pending booking request P at V3 for exactly E's period (`D 14:00`–`D 18:00`), layout Theatre, attendance 80. CR proposes `proposedStartAt` `D 15:00`, nothing else. |
| Test Steps | 1. As C, send `POST /api/v1/change-requests/<CR>/decision` with `{"decision":"APPROVE"}`.<br>2. As VS, send `POST /api/v1/booking-requests/<P>/approve`.<br>3. Read P's booking (`booking_id`) through the venue module's booking read (or the repository).<br>4. As C, send `GET /api/v1/events/<E>/arrangement-flags`.<br>5. As C, send `POST /api/v1/events/<E>/confirmation`.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-T14 '` (or the whole suite) and read the named `S3-T14 ` result. |
| Test Data | `{"decision":"APPROVE"}`; CR proposes `proposedStartAt` `D 15:00`; P at V3 for `D 14:00`–`D 18:00`. |
| Expected Result | Step 1 answers HTTP 200; `impact.bookings` includes P with `arrangement` `BOOKING_REQUEST`, and `impact.flags` includes `{arrangement: BOOKING_REQUEST, id: P, reference: P's reference, name: Venue Three, flag: REQUIRES_RECONFIRMATION, reason: "The booking request is for <old period>, but the event is now <new period>."}`. Step 2 answers HTTP 200 and P is Approved. In step 3, P's booking is CONFIRMED for `D 14:00`–`D 18:00` and flagged Requires Reconfirmation. Step 4 lists that booking (`arrangement` `BOOKING`, P's reference, Venue Three) with `REQUIRES_RECONFIRMATION` and the same reason, and no booking-request flag. Step 5 answers HTTP 422 `ARRANGEMENTS_NOT_READY`, and `details.flags` includes `{arrangement: BOOKING, reference: P's reference, name: Venue Three, flag: REQUIRES_RECONFIRMATION}`. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against S3's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for migrations venue/0018 and equipment/0009 on a CI database. Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
