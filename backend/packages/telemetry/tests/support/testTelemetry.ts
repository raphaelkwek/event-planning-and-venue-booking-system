import { AggregationTemporality, InMemoryMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter, type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { startTelemetry, type Telemetry } from "../../src/index.js";

/**
 * Starts the SDK with in-memory exporters, as a service's `telemetry.ts` would
 * with OTLP ones. Call it before the file imports `express`: the HTTP and
 * Express instrumentations patch those modules as they load.
 */
export function startForTest(serviceName = "test-service") {
  const spans = new InMemorySpanExporter();
  const metricExporter = new InMemoryMetricExporter(AggregationTemporality.CUMULATIVE);
  const metricReader = new PeriodicExportingMetricReader({ exporter: metricExporter, exportIntervalMillis: 3_600_000 });
  const telemetry: Telemetry = startTelemetry({ serviceName, env: {}, spanExporter: spans, metricReader });

  return {
    telemetry,
    spans,
    finished: (): ReadableSpan[] => spans.getFinishedSpans(),
    byName: (name: string | RegExp): ReadableSpan[] =>
      spans.getFinishedSpans().filter((s) => (typeof name === "string" ? s.name === name : name.test(s.name))),
    /** The metric data points recorded so far, by instrument name. */
    async metric(name: string) {
      await telemetry.forceFlush();
      return metricExporter
        .getMetrics()
        .flatMap((batch) => batch.scopeMetrics)
        .flatMap((scope) => scope.metrics)
        .filter((m) => m.descriptor.name === name)
        .at(-1);
    },
  };
}

export const parentIdOf = (span: ReadableSpan): string | undefined => span.parentSpanContext?.spanId;
