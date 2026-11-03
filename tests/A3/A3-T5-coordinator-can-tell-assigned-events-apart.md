# A3-T5 — A coordinator's lists show only their own events, each marked as theirs

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T5 |
| Test Scenario | A coordinator's lists show only their own events, each marked as theirs |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser@connectsphere.test`: FX-SUBMITTED with Event name `First assigned request`, then FX-ASSIGNED to Coordinator One.<br>3. As `organiser@connectsphere.test`: FX-SUBMITTED with Event name `Second assigned request`, then FX-ASSIGNED to Coordinator Two. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue".<br>3. Click "All events". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | In steps 2 and 3, "First assigned request" is listed and shows "You" under "Assigned to"; "Second assigned request" is not listed. "All events" offers no "Every event" or "Assigned to me" button. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** Every event a coordinator's lists show is their own, so the screens mark each as theirs and offer no "Assigned to me" filter. The pre-conditions no longer use `EVENT_COORDINATOR_POOL`, which E3 retired.

## Execution record

| Item | Content |
|---|---|
| Actual Result | In the Review queue and in "All events" the coordinator's own request was marked "You" and the other coordinator's was not listed; no "Every event" or "Assigned to me" button was offered. (Assignment made by the Lead, since E3 replaced the coordinator pool.) Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6f5ed43 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A3-T5 a coordinator's lists show only their own events, each marked as theirs, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41604122084 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
