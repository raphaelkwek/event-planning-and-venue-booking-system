# EN-12-T1 — Kong accepts the committed `gateway/kong.yml` and the configuration rendered from it

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T1 |
| Test Scenario | Kong accepts the committed `gateway/kong.yml` and the configuration rendered from it |
| Pre-conditions | 1. Docker available (CI only; ADR-0012). The `kong:3.9` image. |
| Test Steps | 1. Run the `Validate the Kong configuration` steps of the `Kong configuration` job in `.github/workflows/gateway.yml`: `kong config parse` on `gateway/kong.yml`, then on the output of `gateway/scripts/render-config.mjs` for a throwaway JWKS. |
| Test Data | The committed file (no credentials) and a rendered file (one ES256 key, the echo upstream and low limits) |
| Expected Result | Both parse with exit code 0 (`parse successful`). A file with an unknown plugin field or a route without a service would fail, which is what the step guards. |
| Acceptance criterion | Kong in DB-less mode with declarative config in gateway/kong.yml; the config is validated in CI. |
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
