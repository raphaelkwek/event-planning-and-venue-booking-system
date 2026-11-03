import { startTelemetry } from "@connectsphere/telemetry";

/**
 * planning-core's OpenTelemetry (EN-08, ADR-0013). `src/index.ts` imports this file
 * before anything else, because the HTTP instrumentation patches `http` as it loads.
 * It reads only the standard OTEL_* variables, so it needs nothing from config.ts
 * (which would fail here, before the process has reported why, if DATABASE_URL were missing).
 * With no OTEL_EXPORTER_OTLP_ENDPOINT it exports nothing and prints nothing.
 */
export const SERVICE_NAME = process.env.PLANNING_CORE_SERVICE_NAME ?? "planning-core";

export const telemetry = startTelemetry({ serviceName: SERVICE_NAME });
