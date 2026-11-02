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
| Actual Result | Through the Toxiproxy proxy, select 1 took longer by at least 500 ms (less 50 ms tolerance) with the 500 ms latency toxic, and was fast again once it was removed; with the proxy disabled the open connection and a new one both failed, and after enabling it a new connection worked. |
| Status | Pass |
| Remarks | Automated (load and chaos run in CI) · Commit: faf5ebc · Evidence: `chaos/experiments/00-toxiproxy.test.ts` › Toxiproxy (EN-20-T7) › a 500 ms latency toxic makes a query through the proxy at least 500 ms slower (EN-20-T7); a disabled proxy refuses new connections and drops the open one, and enabling it brings both back (EN-20-T7), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41533430275 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
