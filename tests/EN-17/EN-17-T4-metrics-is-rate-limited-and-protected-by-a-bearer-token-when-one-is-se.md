# EN-17-T4 — /metrics is rate-limited and protected by a bearer token when one is set

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T4 |
| Test Scenario | /metrics is rate-limited and protected by a bearer token when one is set |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Create the metrics router with a token.<br>2. Request without a token, with a wrong token, with the right token.<br>3. Create it with a limit of 2 and call it three times.<br>4. Create it in production without a token. |
| Test Data | Token 'scrape-secret'; limit 2 per window. |
| Expected Result | Missing and wrong tokens get 401; the right one gets 200; the third request in the window gets 429 RATE_LIMITED; production with no token answers 404 (the endpoint is off). |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With a token set, /metrics answered 401 with no token, with a wrong token and with a too-short token, and 200 with the right one. With a limit of two a minute, the first two requests answered 200 and the third answered 429 with the error code RATE_LIMITED. In production with no token set, /metrics answered 404; in production with a token set and sent, 200. |
| Status | Pass |
| Remarks | Automated (unit) · Commit: a74ca8b · Evidence: backend/packages/observability/tests/metrics.unit.test.ts › EN-17-T4 a token is required when one is set; EN-17-T4 the third request in a window of two is refused with RATE_LIMITED; EN-17-T4 production without a token switches the endpoint off (7 of 7 tests in the file passed), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Lint, typecheck, build, unit tests · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
