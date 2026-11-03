import { startTelemetry } from "@connectsphere/telemetry";

/**
 * The Temporal worker is its own process (`npm run worker`), so it starts its own SDK, named apart from the
 * API so its spans can be told from planning-core's in Grafana (EN-08, ADR-0013). It uses the same OTEL_*
 * variables; unset, it exports nothing. Imported first by worker.ts.
 */
export const telemetry = startTelemetry({ serviceName: "planning-core-worker" });
