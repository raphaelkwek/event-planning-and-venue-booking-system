# R2-T11 — The owning organiser sets their event's registration window; another organiser and an invalid window are refused, storing nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T11 |
| Test Scenario | The owning organiser sets their event's registration window; another organiser and an invalid window are refused, storing nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-APPROVED completed. Note the request's id.<br>3. Signed in as `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open the request from "My requests" and click "Registration settings".<br>2. Tick "Attendees register for this event", set Registration opens `1 December 2026, 09:00` and Registration closes `30 November 2026, 09:00`, and click "Save registration settings".<br>3. Change Registration closes to `2 December 2026, 12:00` and save again.<br>4. Sign out, sign in as `organiser2@connectsphere.test` and open `#/events/<id>/registration`. |
| Test Data | Event start 2 December 2026, 14:00 (the standard request) |
| Expected Result | Step 2 is refused: under Registration closes, `Registration closing must be later than registration opening.`, and nothing is saved. Step 3 shows "Registration settings saved." and the request shows the new window. Step 4 shows that no event with that reference is available, and changes nothing. (A closing after the event start is refused with `Registration closing must be no later than the event start.`) |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
