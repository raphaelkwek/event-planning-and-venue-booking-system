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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
