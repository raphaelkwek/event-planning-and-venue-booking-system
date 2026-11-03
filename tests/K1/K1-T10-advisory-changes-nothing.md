# K1-T10 — The check is advisory: it creates, changes and blocks no booking

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T10 |
| Test Scenario | The check is advisory: it creates, changes and blocks no booking |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the venue's availability for 7 to 13 Dec 2026 and note it.<br>2. Run the check for `K1-E-ALLWRONG` (Not suitable) and for `K1-E-FIT` (Suitable).<br>3. Reopen the availability for the same dates.<br>4. Open each event. |
| Test Data | Event `K1-E-ALLWRONG`, `K1-E-FIT` · Venue `K1 Test Hall` |
| Expected Result | The availability is the same before and after: no pending request, hold or booking appeared. Neither event changed status or any field. Nothing on the screen offers to block or submit a booking. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The venue's availability was the same before and after running the check for the Not-suitable and the Suitable event; neither event gained a request, hold or booking or changed status or any field; the results offered only `Check suitability` and `Back to venue`. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/j-venue-search.spec.ts › K1-T10 the check is advisory: it creates, changes and blocks no booking, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
