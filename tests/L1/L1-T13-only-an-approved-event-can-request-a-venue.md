# L1-T13 — Boundary: an event can't request a venue before it is approved (Under Review), and can once it is (Approved)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T13 |
| Test Scenario | Boundary: an event can't request a venue before it is approved (Under Review), and can once it is (Approved) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed. Note the venue's id.<br>3. FX-UNDER-REVIEW completed. Note its id and which coordinator is assigned.<br>4. Signed in as that coordinator. |
| Test Steps | 1. Open the API console and send `POST /venue/api/v1/booking-requests` for the Under Review event (L1-T10's body, with its id and no `replacesBookingId`).<br>2. Approve the request ("Approve" on its review page) and send the same request again. |
| Test Data | Account: the assigned coordinator |
| Expected Result | Step 1 returns `409` `EVENT_NOT_BOOKABLE`, naming the event's status (Under Review) and saying a venue can be requested once the event is approved; nothing is stored. Step 2 returns `201` with the request Pending. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
