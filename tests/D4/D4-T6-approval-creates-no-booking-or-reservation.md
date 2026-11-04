# D4-T6 — Approval alone creates no venue booking and no equipment reservation

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T6 |
| Test Scenario | Approval alone creates no venue booking and no equipment reservation |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id.<br>2. Go to http://localhost:5173, sign in as `coordinator@connectsphere.test`, and open the approved request. |
| Test Data | Query: `select envelope->>'type' as message_type from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | `event.submitted`, `event.coordinator-assigned` and `event.approved` appear once each; the only other types are `event.status-changed` (one each for Submitted, Under Review and Approved) and `event.listing-changed`, all on the event topic. Nothing that would book a venue or reserve equipment was emitted — approval announces the decision and stops there — and the event has no venue slot, booking request, hold, equipment line or reservation. The request screen shows status "Approved" and offers no booking or reservation. |
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

> **Revised 2026-11-04.** Step 1 names the Supabase SQL editor, which an automated run can't use. The test does
> FX-APPROVED on CI's throwaway stack and runs the same query, unchanged, against that stack's database; step 2 is done
> in the browser as written.

> **Revised again 2026-11-04 (Joash).** "Exactly these three" predates two later stories that write to the same
> outbox: EN-11 announces every status change (`event.status-changed`), and R1 and R5 keep the registration service's
> copy of the event current (`event.listing-changed`, on each status change and on the Lead's assignment). Neither asks
> venue or equipment to do anything, so the case's point stands; the list now names them, and, as the 2026-09-20 note
> asked once H1/L1 and O1/Q1 landed, the absence of a booking and a reservation is now asserted directly too.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Specification revised 2026-09-20; the previous record (Blocked, Joash, 2026-09-20) was against the pre-revision specification. |
| Executed By | |
| Date of Execution | |
