# EN-20-T7 — Toxiproxy runs in CI and a toxic really changes the connection

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-20-T7 |
| Test Scenario | Toxiproxy runs in CI and a toxic really changes the connection |
| Pre-conditions | 1. Run in the `Load and chaos` workflow (`.github/workflows/load-chaos.yml`): a throwaway Postgres, a Toxiproxy container (`ghcr.io/shopify/toxiproxy`) and, where a broker is needed, a Redpanda container, all on the runner. Never the team's database or Kafka cluster. |
| Test Steps | 1. Start Toxiproxy and create a proxy to the throwaway Postgres.<br>2. Time a query through the proxy with and without a 500 ms latency toxic.<br>3. Disable the proxy and try to connect. |
| Test Data | `select 1` through the proxy. |
| Expected Result | The query takes at least 500 ms longer with the toxic than without, and a connection through a disabled proxy fails. Experiments 2, 3 and 5 build on this. |
| Acceptance criterion | Toxiproxy in CI. |
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
