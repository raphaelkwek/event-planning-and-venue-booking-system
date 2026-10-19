# L3-T2 — A coordinator who isn't assigned to the event, and the event's organiser, cannot request a hold

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T2 |
| Test Scenario | A coordinator who isn't assigned to the event, and the event's organiser, cannot request a hold |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned. |
| Test Steps | 1. Sign in as the coordinator who is **not** assigned and open the event's "Venue requests".<br>2. In the API console, as that coordinator, `POST /venue/api/v1/holds` with the body below.<br>3. Sign in as `organiser@connectsphere.test` and open the event's "Venue requests". |
| Test Data | Body: `{"eventId":"<EVENT_ID>","venueId":"<LKC_ID>","startsAt":"2026-12-02T14:00+08:00","endsAt":"2026-12-02T18:00+08:00","reminderLeadMinutes":1440}` |
| Expected Result | Steps 1 and 3 show no "Request a hold" button. Step 2 answers 403 `ROLE_NOT_AUTHORISED`, "Only the event's assigned coordinator can request a hold for it." No hold is stored. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
