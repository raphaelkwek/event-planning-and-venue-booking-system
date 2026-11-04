# EN-07-T4 — The staff console's navigation and route guard show only what the policy decision point allows the signed-in role

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T4 |
| Test Scenario | The staff console's navigation and route guard show only what the policy decision point allows the signed-in role |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Sign in as `organiser@connectsphere.test` and read the navigation.<br>2. Sign out, sign in as `venuestaff@connectsphere.test` and read the navigation.<br>3. As Venue Staff, open `http://localhost:5173/#/queue` directly. |
| Test Data | Accounts: `organiser@connectsphere.test`, `venuestaff@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Expected Result | The console asks planning-core's `POST /api/v1/permissions/check` once per session for the resource and action behind each screen. The organiser's navigation offers My requests and New request and no Review queue; Venue Staff's offers Booking requests and Hold requests and no Review queue. Opening the review queue as Venue Staff lands on their own start page. The console holds no list of roles per screen. |
| Acceptance criterion | AC1: Cerbos policies in the repo, evaluated by the gateway, the services and the SPA's navigation. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

> **Corrected 2026-11-04.** The steps named `venue-staff@connectsphere.test`; the seeded Venue Staff account is
> `venuestaff@connectsphere.test` (`tests/README.md`). Nothing else changed.

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Partly proven: frontend/tests/permissions.test.tsx › EN-07-T4 (three tests) checks the console sends one permissions request with the token, every screen's action and no role, shows an organiser My requests and New request but no Review queue, shows Venue Staff Booking requests and Hold requests, sends Venue Staff from #/queue to their start page, and fails closed; the browser tests on the ephemeral stack passed with a PDP (CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625). UI walk-through in Chrome pending at the sprint review · Commit: 7f1c8fa · Defect: — |
| Executed By |  |
| Date of Execution |  |
