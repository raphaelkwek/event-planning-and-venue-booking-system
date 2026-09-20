# D4-T6 — Approval alone creates no venue booking and no equipment reservation

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T6 |
| Test Scenario | Approval alone creates no venue booking and no equipment reservation |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id.<br>2. Go to http://localhost:5173, sign in as `coordinator@connectsphere.test`, and open the approved request. |
| Test Data | Query: `select envelope->>'messageType' as message_type from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | The message types are exactly `event.submitted`, `event.coordinator-assigned` and `event.approved`. Nothing that would book a venue or reserve equipment was emitted — approval announces the decision and stops there. The request screen shows status "Approved" and offers no booking or reservation. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

> **Revised 2026-09-20.** As written, this case checked the absence of a booking and a reservation by
> opening a Venue Staff booking list and a Technical Support reservation list — neither of which
> exists (Venue H1/L1 and Equipment O1/Q1 are Sprint 2–3), so the case could not be run at all. The
> assertion is D4's own: approval must not reach into venue or equipment. It is now checked where
> approval's effects actually live — the outbox is the only way this service asks another service to
> do anything, so an approval that emitted nothing but `event.approved` cannot have booked or
> reserved. Re-check this case when H1/L1 and O1/Q1 land: once booking and reservation records exist,
> their absence is worth asserting directly as well.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Specification revised 2026-09-20; the previous record (Blocked, Joash, 2026-09-20) was against the pre-revision specification. |
| Executed By | |
| Date of Execution | |
