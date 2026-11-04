# M1-T2 — The queue shows any unsuitability justification recorded with the request (K2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T2 |
| Test Scenario | The queue shows any unsuitability justification recorded with the request (K2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested a venue K1 finds Not suitable, recording the justification `The only hall free that week` (K2).<br>4. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests". |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The request's row shows the justification and the failing conditions as evaluated when the request was made. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

> **Waits for K2.** K2 records the justification and the failing conditions with the request, and
> isn't built yet. Until it is, no request carries one and this case can't be set up. It stays Not
> Executed, owned by K2 (Sprint 3); the queue's other columns are M1-T1.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Venue Staff Booking requests queue row for the unsuitable request showed `Not suitable`, both stored failing conditions (attendance against capacity, the missing facility) and `Justification: …` with the recorded text. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/j-venue-search.spec.ts › M1-T2 the queue shows the unsuitability justification and the failing conditions recorded with the request, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
