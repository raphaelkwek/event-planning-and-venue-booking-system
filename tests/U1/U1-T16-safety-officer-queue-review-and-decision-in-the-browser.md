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
| Actual Result | Not run in a browser. The queue, the review with its decision form and the Mark Confirmed button are covered at component level by frontend/tests/safetyReview.test.tsx (what each screen shows and sends), not the signed-in walk-through. |
| Status | Not Executed |
| Remarks | Partly proven by frontend/tests/safetyReview.test.tsx, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839. UI walk-through in Chrome pending at the sprint review · Defect: — |
| Executed By | |
| Date of Execution | |
