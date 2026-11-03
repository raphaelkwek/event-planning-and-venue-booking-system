# R1-T4 — Negative: events that are Draft, Submitted, Under Review, Approved, Planning, Safety Review, Rejected, Cancelled or Completed do not appear, even with registration open

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T4 |
| Test Scenario | Negative: events that are Draft, Submitted, Under Review, Approved, Planning, Safety Review, Rejected, Cancelled or Completed do not appear, even with registration open |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run once per status in Test Data, each named `R Status <STATUS>`, with registration open.<br>3. FX-R-EVENT run once more with its defaults (Confirmed).<br>4. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events".<br>2. Look for every `R Status …` event. |
| Test Data | Statuses: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `PLANNING`, `SAFETY_REVIEW`, `REJECTED`, `CANCELLED`, `COMPLETED` |
| Expected Result | Only `R Test Symposium` (Confirmed) is listed. None of the nine `R Status …` events appears. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Only the Confirmed symposium was listed; none of the nine events in Draft, Submitted, Under Review, Approved, Planning, Safety Review, Rejected, Cancelled and Completed appeared, and the list held exactly one event. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R1-T4 events in any status but Confirmed are not listed, even with registration open, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
