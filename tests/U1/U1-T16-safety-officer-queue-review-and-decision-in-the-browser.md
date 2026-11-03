# U1-T16 — Safety Officer queue, review and decision in the browser

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T16 |
| Test Scenario | Safety Officer queue, review and decision in the browser |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. The app is running (`tests/README.md`) and `safety@connectsphere.test` exists. Done by hand at the sprint review. |
| Test Steps | 1. Sign in as the Safety Officer: the navigation offers the Safety queue.<br>2. Open the queue, open E1's review, read the factors, choose Request changes without a reason and then with one.<br>3. Sign in as the assigned coordinator and press Mark Confirmed on an approved event. |
| Test Data | As the steps. |
| Expected Result | Each screen shows what the API returns, the decision form refuses a missing reason, and the Mark Confirmed button appears only for the assigned coordinator on an event in Safety Review, and shows the server's refusal until the Safety Officer has approved. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Safety Officer's navigation offered the Safety queue, which listed both events waiting (`Awaiting your decision`); E1's review showed attendance 150, the accessibility needs, the booked venue with Theatre and its layouts (Theatre (300), Classroom (120), Banquet (180)), and the equipment with its placement note. Request changes without a reason was refused with `Give a reason when you request changes or reject the safety arrangement.` and changed nothing; with a reason it was recorded and the event returned to Planning. The coordinator's Mark Confirmed on the other event showed `The Safety Officer has not approved this event's safety arrangements, so it cannot be marked Confirmed.`; another coordinator was not offered it; after the Safety Officer approved (queue entry `Approved, awaiting Mark Confirmed`) Mark Confirmed moved the event to Confirmed. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/u-safety-and-assignment.spec.ts › U1-T16 Safety Officer queue, review and decision in the browser, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
