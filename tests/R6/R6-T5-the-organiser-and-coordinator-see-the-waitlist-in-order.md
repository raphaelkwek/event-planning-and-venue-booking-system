# R6-T5 — Waitlist entries are kept in the order they were created, and the owning organiser and assigned coordinator see that order

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T5 |
| Test Scenario | Waitlist entries are kept in the order they were created, and the owning organiser and assigned coordinator see that order |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`.<br>2. FX-R-EVENT with `<SEATS>` 1, FX-R-MANAGED, FX-R-TAKEN with `<N>` = 1, then FX-R-WAITLISTED with `<N>` = 2.<br>3. Attendee One joins the waitlist (R6-T1 step 1), third. |
| Test Steps | 1. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. Open the list as in R5-T1 and read the Waitlist section.<br>2. Sign in as `coordinator@connectsphere.test` and do the same.<br>3. Sign in as `organiser2@connectsphere.test` and do the same. |
| Test Data | 3 waitlisted attendees, Attendee One last |
| Expected Result | Steps 1 and 2: positions 1, 2, 3 in the order joined, Attendee One at 3, each `Waitlisted` with its time. Step 3: no waitlist data. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The organiser's and then the coordinator's Registrations screen listed the waitlist as three rows with positions 1, 2 and 3 in the order joined, each `Waitlisted` with its joined time, Attendee One at 3. Organiser Two saw `This event's registrations are not available to you`, and the waitlist request answered 404 with no entries. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R6-T5 the organiser and the coordinator see the waitlist in the order it was joined, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
