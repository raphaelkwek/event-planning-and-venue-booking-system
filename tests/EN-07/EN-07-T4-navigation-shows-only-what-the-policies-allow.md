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
| Actual Result | In the browser on CI's stack, with a real Cerbos policy decision point. Step 1: signed in as the organiser, the console sent one POST to planning-core's /api/v1/permissions/check (through /identity), with the organiser's token and a body of `checks` only: each screen's resource and action once (all 28 of App.tsx's screens), naming no role or principal. The decision point allowed `event:create` and `event:view_draft` and not `event:review`, and the navigation offered exactly the screens its answer allowed, among them My requests and New request, and no Review queue; moving to New request and Notifications sent no second check. Step 2: signed in as Venue Staff (the seeded venuestaff@connectsphere.test; the card writes it venue-staff@), one check again, with that token; `booking_request:view_queue` allowed and `event:review` not, and the navigation offered exactly what was allowed, among them Booking requests and Hold requests, and no Review queue. Step 3: from Booking requests, opening #/queue by its address landed on Venue Staff's start page, the API console (#/console, `Direct API console`), and no review queue was shown. The console holds no list of roles per screen: its request names no role, and what it offered followed the decision point's answer screen for screen (the screen tests check the same against answers they control). |
| Status | Pass |
| Remarks | Automated (browser, Playwright; unit test) · Commit: 5bfb25e · Evidence: tests/e2e/e-access-and-console.spec.ts › EN-07-T4 the navigation and the route guard follow the policy decision point, asked once per session with no role; `frontend/tests/permissions.test.tsx` › navigation from the policies (EN-07-T4) › EN-07-T4 asks once, with the token and every screen's resource and action but no role, and offers only what is allowed; `frontend/tests/permissions.test.tsx` › navigation from the policies (EN-07-T4) › EN-07-T4 a screen the policies don't allow lands on the role's start page instead, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
