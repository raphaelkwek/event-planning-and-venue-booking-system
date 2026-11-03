# L4-T9 — Cancelling the event releases all of its venue arrangements (F3, F4)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T9 |
| Test Scenario | Cancelling the event releases all of its venue arrangements (F3, F4) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, with a confirmed booking at `Lee Kong Chian Auditorium`, a placed hold at `Seminar Room 2-1` and a pending request for `Mochtar Riady Hall`, all 14:00–18:00 (L4-T5's pre-conditions). |
| Test Steps | 1. Cancel the event (F3, F4).<br>2. Open the event's Venue requests, and each venue's availability for 2 December 2026. |
| Test Data | One booking, one hold, one request |
| Expected Result | The booking and the hold are Released and the request is Withdrawn. All three venues are free from 14:00 to 18:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

> **Not executable yet.** Cancelling an event is F3 and F4, which aren't built. The venue module's half is: `releaseVenueArrangementsForEvent` releases every booking and hold and withdraws every pending request of the event, for F4's cancellation to call. It is integration-tested (`tests/venue/api/severalVenues.test.ts`).

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the coordinator cancelled the event, its Venue requests screen showed the booking and the hold Released and the pending request Withdrawn, and each of the three venues was free for its whole opening day with no item for the event. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/j-venue-search.spec.ts › L4-T9 cancelling the event releases its booking and hold, withdraws its request, and frees all three venues, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
