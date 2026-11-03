import { AggregationTemporality, InMemoryMetricExporter, PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { InMemorySpanExporter, type ReadableSpan } from "@opentelemetry/sdk-trace-base";
import { startTelemetry, type Telemetry } from "./sdk.js";

/**
 * The SDK with in-memory exporters, for tests that assert on the spans and metrics a
 * piece of code produces. Call it before the test file imports `express`: the HTTP
 * instrumentation patches `http` as it loads. Not used by any service at run time.
 */
export function startInMemoryTelemetry(serviceName = "test-service") {
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
    /** The latest export of one instrument (cumulative since start), flushing first. */
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

/** The id of a span's parent, or undefined for a root. */
export const parentIdOf = (span: ReadableSpan): string | undefined => span.parentSpanContext?.spanId;
