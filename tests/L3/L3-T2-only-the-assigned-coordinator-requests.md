# L3-T2 — A coordinator who isn't assigned to the event, and the event's organiser, cannot request a hold

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T2 |
| Test Scenario | A coordinator who isn't assigned to the event, and the event's organiser, cannot request a hold |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned. |
| Test Steps | 1. Sign in as the coordinator who is **not** assigned and go to the event's "Venue requests" (`#/events/<id>/venue-requests`).<br>2. In the API console, as that coordinator, `POST /venue/api/v1/holds` with the body below.<br>3. Sign in as `organiser@connectsphere.test` and open the event's "Venue requests". |
| Test Data | Body: `{"eventId":"<EVENT_ID>","venueId":"<LKC_ID>","startsAt":"2026-12-02T14:00+08:00","endsAt":"2026-12-02T18:00+08:00","reminderLeadMinutes":1440}` |
| Expected Result | Step 1 shows "No event with that reference is assigned to you." and no event detail. Step 2 answers 404 `EVENT_NOT_FOUND`, "No event with that reference is assigned to you.". Step 3 shows no "Request a hold" button. No hold is stored. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** The coordinator who isn't assigned can't open the event, and the API answers 404 as for an unknown event.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-02; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |