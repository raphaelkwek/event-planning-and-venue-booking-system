# R4-T8 — The owning organiser sets their event's withdrawal deadline; one after the event start is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | R4-T8 |
| Test Scenario | The owning organiser sets their event's withdrawal deadline; one after the event start is refused |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-APPROVED completed. Note the request's id.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open the request from "My requests" and click "Registration settings".<br>2. Tick "Attendees register for this event", set Registration opens `1 December 2026, 09:00`, Registration closes `2 December 2026, 12:00`, Withdrawal deadline `2 December 2026, 15:00`, and click "Save registration settings".<br>3. Change Withdrawal deadline to `2 December 2026, 13:00` and save again.<br>4. Clear Withdrawal deadline and save again. |
| Test Data | Event start 2 December 2026, 14:00 |
| Expected Result | Step 2 is refused: under Withdrawal deadline, `The withdrawal deadline must be no later than the event start.`; nothing is saved. Step 3 shows "Registration settings saved." with the deadline 2 December 2026, 13:00. Step 4 saves with no deadline, which means withdrawal is allowed until the event starts. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A withdrawal deadline after the event start was refused under Withdrawal deadline with `The withdrawal deadline must be no later than the event start.` and nothing was saved; 13:00 saved with `Registration settings saved.` (checked through the API); clearing it saved with no deadline and the screen said attendees can withdraw until the event starts. Run on CI's throwaway stack, with unique names in place of the card's literal names. The request is on 2 December 2030, the card's time of day. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/r-registration.spec.ts › R4-T8 the owning organiser sets the withdrawal deadline; one after the event start is refused, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
