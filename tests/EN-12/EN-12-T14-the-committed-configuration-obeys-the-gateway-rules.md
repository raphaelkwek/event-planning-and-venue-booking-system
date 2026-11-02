# EN-12-T14 — The committed `gateway/kong.yml` keeps every route behind the right plugins

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T14 |
| Test Scenario | The committed `gateway/kong.yml` keeps every route behind the right plugins |
| Pre-conditions | 1. Dependencies installed (`npm ci`). No network, no Docker. |
| Test Steps | 1. Run `node --test gateway/tests/kongConfig.test.mjs`.<br>2. Find the tests named `EN-12-T14`. |
| Test Data | gateway/kong.yml |
| Expected Result | Every staff route has the jwt plugin (checking the key id and expiry) and a per-user rate limit; every public route has a per-address limit; all limits use the Redis policy; staff limit 300 and public limit 600 a minute; correlation-id is on; no route matches a health, ready or metrics path; no staff and public service share an upstream; the file holds no key or secret. |
| Acceptance criterion | JWT plugin, Redis-backed per-user and per-IP limits, trace headers and separate staff and public routes, as configuration. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
