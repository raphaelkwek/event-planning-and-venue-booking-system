# I2-T1 — Venue Staff record a period of unavailability with its venue, start, end, reason type and description; the block records who created it and when

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T1 |
| Test Scenario | Venue Staff record a period of unavailability with its venue, start, end, reason type and description; the block records who created it and when |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`).<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "View" on `Lee Kong Chian Auditorium`, then "Unavailability".<br>2. Enter the Test Data and click "Review".<br>3. Click "Record unavailability" in the dialog.<br>4. In the SQL editor, read the block: `select venue_id, starts_at, ends_at, reason_type, description, status, created_by, created_at from venue.unavailability_blocks where description = 'Annual rigging inspection';` |
| Test Data | Account: `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!` · Start 9 December 2026 09:00 · End 9 December 2026 13:00 · Reason type Maintenance · Description `Annual rigging inspection` |
| Expected Result | The dialog says nothing is disrupted. "Unavailability recorded." is shown and the block is listed with Wednesday 9 December 2026, 09:00–13:00, Maintenance and the description. The row is `ACTIVE` at `Lee Kong Chian Auditorium`, created by `00000000-0000-0000-0000-000000000003` within the last minute. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog said nothing is disrupted, the notice and the block row; the API showed it Active with its period, Maintenance, description, creator and time. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/l-bookings.spec.ts › I2-T1 Venue Staff record a period of unavailability, recording who created it and when, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
