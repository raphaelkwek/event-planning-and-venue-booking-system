# R6-T9 — Waitlist entries consume no places and are never counted as registrations in R5's totals

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T9 |
| Test Scenario | Waitlist entries consume no places and are never counted as registrations in R5's totals |
| Pre-conditions | 1. R6-T5 done. |
| Test Steps | 1. As the organiser, read the list's totals.<br>2. As Attendee One, open the event from "Events". |
| Test Data | 1 seat taken, 3 waitlisted |
| Expected Result | Step 1: `Registered 1`, `Places remaining 0`; the waitlist's 3 entries are shown apart (`Waiting 3`) and not in the registration totals or rows. Step 2: `Full`. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r6Cards.test.ts › R6-T9 never counts waitlist entries as registrations or places, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
