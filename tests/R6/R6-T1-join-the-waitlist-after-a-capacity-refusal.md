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
| Actual Result | The event's page showed Full and no Register button; Join the waitlist answered 201 and the page showed `You are on the waitlist` and `WL-<six digits>: you are number 1 in line for <event>.` My registrations' Waitlist section showed the event, `Waitlisted` and `WL-… · Joined <time> · Number 1 in line`; the database held that entry as WAITLISTED and no registration for Attendee One. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R6-T1 an attendee refused for capacity joins the waitlist; no registration is made, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
