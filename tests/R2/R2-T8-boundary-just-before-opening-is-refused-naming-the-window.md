# R2-T8 — Boundary: a registration one millisecond before opening is refused, naming the window, with nothing stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T8 |
| Test Scenario | Boundary: a registration one millisecond before opening is refused, naming the window, with nothing stored |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with `<OPENS>` = `now() + interval '1 day'`. (Automated with the clock fixed at 1 ms before opening.)<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open `R Test Symposium` from "Events" (it is listed: its closing has not passed) and click "Register".<br>2. Count the attendee's registrations for the event. |
| Test Data | Opening one day after the fixture runs |
| Expected Result | The page shows the server's message naming the window: `Registration for … opens on <day>, <time> and closes on <day>, <time>, so you cannot register now.`; the response is `422` `REGISTRATION_OUTSIDE_WINDOW`. No registration is stored and places remaining is unchanged. |
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
