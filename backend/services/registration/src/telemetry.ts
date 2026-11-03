import { startTelemetry } from "@connectsphere/telemetry";

/**
 * The registration service's OpenTelemetry (EN-08, ADR-0013). `src/index.ts` imports this
 * file before anything else, because the HTTP instrumentation patches `http` as it loads.
 * With no OTEL_EXPORTER_OTLP_ENDPOINT it exports nothing and prints nothing.
 */
export const SERVICE_NAME = "registration";

export const telemetry = startTelemetry({ serviceName: SERVICE_NAME });
