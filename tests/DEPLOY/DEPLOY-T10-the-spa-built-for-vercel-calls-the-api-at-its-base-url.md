# DEPLOY-T10 — The SPA built for Vercel calls the API at VITE_API_BASE_URL

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T10 |
| Test Scenario | The SPA built for Vercel calls the API at VITE_API_BASE_URL |
| Pre-conditions | 1. The frontend unit tests run. |
| Test Steps | 1. Call an API function with the base URL set.<br>2. Call it with the default (empty) base URL. |
| Test Data | None. |
| Expected Result | Step 1 requests `<base>/identity/api/v1/...`; step 2 keeps the relative path the dev proxy and the nginx image use. |
| Acceptance criterion | The web app is deployed to Vercel per environment with the VITE_* values per environment. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With a base URL the request went to <base>/identity/api/v1/...; with the default empty base the path stayed relative. |
| Status | Pass |
| Remarks | Automated (unit, CI) · Commit: f76866586a318aa5852f75edab518cb95ffd7690 · Evidence: frontend/tests/apiBaseUrl.test.ts › DEPLOY-T10 (two tests), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563224 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
