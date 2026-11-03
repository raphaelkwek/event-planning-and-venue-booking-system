# K1-T9 — The coordinator re-enters nothing, and the compared values match the event and the catalogue

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T9 |
| Test Scenario | The coordinator re-enters nothing, and the compared values match the event and the catalogue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open the event `K1-E-BIG` and note its attendance, layout, facilities, accessibility needs and period.<br>2. Open `K1 Test Hall` and note its layouts, facilities, features and hours.<br>3. Run the suitability check as in K1-T2.<br>4. Look for any field to type an attendance, layout, facility or period into. |
| Test Data | Event `K1-E-BIG` · Venue `K1 Test Hall` |
| Expected Result | The only choice offered is which event to check. The numbers and names in the reasons are exactly those noted in steps 1 and 2. No field for attendance, layout, facilities or period exists on the check. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The event page and the venue page showed the attendance, layout, facilities, accessibility and period the check compared; the result's reason read `Expected attendance 150 against layout capacity 120 (Theatre).`; the check screen offered only an event choice, with no input for attendance, layout, facilities or period. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/j-venue-search.spec.ts › K1-T9 the check offers only which event to assess, and every value it compares comes from the records, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
