# L6-T10 — The workflow reminds and expires at the right times with nobody calling the API

## Specification

| Item | Content |
|---|---|
| Test Case ID | L6-T10 |
| Test Scenario | The `holdExpiry` Temporal workflow fires the reminder and then the expiry at their times on its own, and a reschedule moves both |
| Pre-conditions | 1. Dependencies installed; no database, Kafka or Temporal server is needed. The test uses Temporal's time-skipping test environment with the activities replaced by recording stubs (see `tests/L6/README.md`).<br>2. FX-L6's timings are used as inputs: H1 expiry 120 minutes after the workflow starts, lead 60 minutes. |
| Test Steps | 1. Start `holdExpiry` for H1 in the time-skipping environment; no API call is made after that.<br>2. Advance the clock to 59 minutes, then to 60 minutes after the start.<br>3. Advance to 119 minutes, then to 120 minutes.<br>4. In a second run, start the workflow, then at 30 minutes send `rescheduleSignal` with an expiry 240 minutes after the start; advance to 120 minutes, then 179, 180, 239 and 240 minutes.<br>5. In a third run, make `expireHoldIfDue` return `not-due` with a new expiry and then `gone`.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/temporal/holdExpiry.unit.test.ts -t 'L6-T10 '` and read the named `L6-T10 ` result. |
| Test Data | Run 1: expiry at 120 minutes, lead 60. Run 2: new expiry at 240 minutes, lead 60. |
| Expected Result | Run 1: `remindHoldIfDue` is called once, at 60 minutes and not at 59; `expireHoldIfDue` once, at 120 minutes and not at 119, and the workflow completes. Run 2: no call occurs at 120 minutes; `remindHoldIfDue` runs at 180 and not at 179; `expireHoldIfDue` runs at 240 and not at 239. Run 3: on `not-due` the workflow waits until the new expiry and calls `expireHoldIfDue` again; on `gone` it stops and calls nothing further. Nobody calls the API at any point: the timers alone drive each call. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-21 |

> **Expected results are checked by the PR reviewer** against L6's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test ran the hold-expiry workflow on Temporal's time-skipping test server with nobody calling the API, and its assertions passed; they check the expected result above. |
| Status | Pass (automated, workflow level) |
| Remarks | Replay histories for holdExpiry are a follow-up: recording them needs a live Temporal server (see the workflow's FOLLOW-UP note). Commit: f7e4b7073b9607b7db396aea29c36f36bd4a5916 · Evidence: backend/services/planning-core/tests/temporal/holdExpiry.unit.test.ts › L6-T10, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/39463319772 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-21 |
