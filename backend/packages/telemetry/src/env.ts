/**
 * Which telemetry leaves the process, decided only from the standard OpenTelemetry
 * environment variables (implementation.md §9, ADR-0013). Pure, so every rule is
 * unit-tested without starting an SDK.
 */
export type Env = Record<string, string | undefined>;

export interface ExportPlan {
  /** Spans are sent to the OTLP endpoint. */
  traces: boolean;
  /** Metrics are sent to the OTLP endpoint. */
  metrics: boolean;
}

/** OTEL_SDK_DISABLED=true switches the whole SDK off: no ids, no propagation, nothing. */
export function isSdkDisabled(env: Env): boolean {
  return env.OTEL_SDK_DISABLED?.trim().toLowerCase() === "true";
}

const filled = (value: string | undefined) => (value ?? "").trim() !== "";

/** An endpoint is set for the signal, either as the shared one or as that signal's own. */
function hasEndpoint(env: Env, signal: "TRACES" | "METRICS"): boolean {
  return filled(env.OTEL_EXPORTER_OTLP_ENDPOINT) || filled(env[`OTEL_EXPORTER_OTLP_${signal}_ENDPOINT`]);
}

/** OTEL_TRACES_EXPORTER=none, or OTEL_METRICS_EXPORTER=none, turns that signal off even with an endpoint. */
function isNone(env: Env, signal: "TRACES" | "METRICS"): boolean {
  return env[`OTEL_${signal}_EXPORTER`]?.trim().toLowerCase() === "none";
}

/**
 * Without an endpoint nothing is exported and nothing is attempted, so a laptop
 * with no Grafana account sees no connection errors and no extra log lines.
 */
export function exportPlan(env: Env): ExportPlan {
  if (isSdkDisabled(env)) return { traces: false, metrics: false };
  return {
    traces: hasEndpoint(env, "TRACES") && !isNone(env, "TRACES"),
    metrics: hasEndpoint(env, "METRICS") && !isNone(env, "METRICS"),
  };
}
