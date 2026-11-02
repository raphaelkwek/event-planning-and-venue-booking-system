# R6-T1 — Refused for capacity, the attendee joins the waitlist: it stores the attendee, the event, status Waitlisted and the time

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T1 |
| Test Scenario | Refused for capacity, the attendee joins the waitlist: it stores the attendee, the event, status Waitlisted and the time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 1, then FX-R-TAKEN with `<N>` = 1.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open the event from "Events" (it shows `Full`) and click "Join the waitlist".<br>2. Open "My registrations" and read the Waitlist section. |
| Test Data | 1 seat, taken |
| Expected Result | Step 1: `You are on the waitlist` with the entry's reference (`WL-` and six digits). Step 2: the event, status `Waitlisted`, `Joined <time>`, position 1. No registration was created. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
