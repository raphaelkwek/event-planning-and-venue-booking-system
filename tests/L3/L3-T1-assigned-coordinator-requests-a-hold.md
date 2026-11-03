# L3-T1 — The assigned coordinator requests a hold; it is stored Requested with an HLD reference, the coordinator, the request time and the reminder lead time, and reserves nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | L3-T1 |
| Test Scenario | The assigned coordinator requests a hold; it is stored Requested with an HLD reference, the coordinator, the request time and the reminder lead time, and reserves nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`). Note the event's id and reference, and which coordinator is assigned.<br>3. Signed in as the assigned coordinator. |
| Test Steps | 1. As the assigned coordinator: "All events" → the event → "Venue requests" → "Request a hold" → Venue `Lee Kong Chian Auditorium`, Date 2 December 2026, Start 14:00, End 18:00, Remind me `1440` minutes before expiry → "Request hold".<br>2. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026.<br>3. Run "Looking a hold up" (`tests/L3/README.md`). |
| Test Data | Account: the assigned coordinator (`coordinator@connectsphere.test` or `coordinator2@connectsphere.test`) / `ConnectSphere-Test-1234!` · 2 December 2026, 14:00–18:00 · Remind me 1440 minutes |
| Expected Result | Step 1 shows "Hold HLD-… requested." and the Holds table lists it: `HLD-` and six digits, `Lee Kong Chian Auditorium`, Wednesday 2 December 2026, 14:00–18:00, status Requested, no expiry yet, reminder 1 day before. Step 2 shows 14:00–18:00 free: a request reserves nothing. Step 3 shows status `REQUESTED`, the assigned coordinator as `requested_by`, a `requested_at` within the last minute, `reminder_lead_minutes` 1440, and no slot. |
| Created By | Yichen Chai, via Claude |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The notice and the hold row; the day stayed free on the calendar; the API showed Requested, the requester, time and reminder, and no slot. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/l-bookings.spec.ts › L3-T1 the assigned coordinator requests a hold; it is stored Requested and reserves nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |