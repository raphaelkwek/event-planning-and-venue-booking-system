# J1-T23 — A window with only one end, or ending before it starts, is refused, naming the field

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T23 |
| Test Scenario | A window with only one end, or ending before it starts, is refused, naming the field |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Set From to 14 December 2026, 12:00 and leave To empty.<br>3. Click “Search”.<br>4. Set To to 14 December 2026, 11:00 and click “Search”.<br>5. Set To to 14 December 2026, 12:00 (the same as From) and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | Each refusal appears as a message under the form, carrying the server's wording, and names the field at fault: To for the missing end, and To for an end that is not after the start. The previous results are not replaced by a list for the bad window. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A window with no To, with To before From, and with To equal to From were each refused with the server's message under To (`Enter when the window ends, as well as when it starts.` / `The window must end after it starts.`), and no results list replaced the previous one. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/j-venue-search.spec.ts › J1-T23 a window with one end, or ending before it starts, is refused naming the field, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
