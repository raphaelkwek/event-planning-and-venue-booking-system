import type { IncomingMessage } from "node:http";
import { context, metrics, propagation, trace } from "@opentelemetry/api";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-proto";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-proto";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { defaultResource, detectResources, envDetector, resourceFromAttributes } from "@opentelemetry/resources";
import { MeterProvider, PeriodicExportingMetricReader, type IMetricReader } from "@opentelemetry/sdk-metrics";
import { BatchSpanProcessor, SimpleSpanProcessor, type SpanExporter, type SpanProcessor } from "@opentelemetry/sdk-trace-base";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { exportPlan, isSdkDisabled, type Env } from "./env.js";

/**
 * Starts OpenTelemetry for one service (ADR-0013, EN-08).
 *
 * Exporting is configured only by the standard variables, which the OTLP
 * exporters read themselves: OTEL_EXPORTER_OTLP_ENDPOINT, OTEL_EXPORTER_OTLP_HEADERS,
 * OTEL_EXPORTER_OTLP_PROTOCOL's sibling signal endpoints, OTEL_SERVICE_NAME and
 * OTEL_RESOURCE_ATTRIBUTES (deployment.environment). With no endpoint nothing
 * is exported and nothing connects anywhere. The tracer is still installed, so
 * trace ids, the correlation id and Kafka's `traceparent` work on a laptop with
 * no Grafana account; spans that nobody exports are discarded. OTEL_SDK_DISABLED=true
 * installs nothing at all.
 *
 * Call it before anything imports `http` or `express`: the instrumentations
 * patch those modules as they load. Each service does that by importing its
 * `telemetry.ts` first.
 */

export interface TelemetryOptions {
  /** The service's own name; OTEL_SERVICE_NAME, when set, replaces it on the resource. */
  serviceName: string;
  env?: Env;
  /** Tests give an in-memory exporter; it is used instead of OTLP, and is flushed after every span. */
  spanExporter?: SpanExporter;
  /** Tests give an in-memory metric reader; it is used instead of OTLP. */
  metricReader?: IMetricReader;
}

export interface Telemetry {
  /** False when OTEL_SDK_DISABLED is true: nothing was installed. */
  readonly enabled: boolean;
  /** Which signals leave the process. */
  readonly exporting: { traces: boolean; metrics: boolean };
  /** The name on the resource, so a log line or a test can say which service it is. */
  readonly serviceName: string;
  forceFlush(): Promise<void>;
  /**
   * Flushes, then uninstalls. A service awaits it before `process.exit`. It gives up after
   * `timeoutMs` (default 5 s) so an unreachable collector cannot outlast a pod's grace period.
   */
  shutdown(timeoutMs?: number): Promise<void>;
}

/** Health probes are polled every few seconds and are not worth a trace each. */
const PROBE_PATH = /^\/(healthz|readyz|metrics)(\?|$)/;
const isProbe = (request: IncomingMessage) => PROBE_PATH.test(request.url ?? "");

/** How long shutdown() waits for the last batch to be exported. */
const SHUTDOWN_TIMEOUT_MS = 5_000;

const DISABLED: Telemetry = {
  enabled: false,
  exporting: { traces: false, metrics: false },
  serviceName: "",
  forceFlush: async () => {},
  shutdown: async () => {},
};

export function startTelemetry(options: TelemetryOptions): Telemetry {
  const env = options.env ?? process.env;
  if (isSdkDisabled(env)) return { ...DISABLED, serviceName: options.serviceName };

  const plan = exportPlan(env);
  // Later wins: the defaults, then this service's name, then OTEL_SERVICE_NAME and OTEL_RESOURCE_ATTRIBUTES.
  const resource = defaultResource()
    .merge(resourceFromAttributes({ "service.name": options.serviceName }))
    .merge(detectResources({ detectors: [envDetector] }));

  const serviceName = String(resource.attributes["service.name"]);

  const spanProcessors: SpanProcessor[] = [];
  if (options.spanExporter) spanProcessors.push(new SimpleSpanProcessor(options.spanExporter));
  else if (plan.traces) spanProcessors.push(new BatchSpanProcessor(new OTLPTraceExporter()));

  const readers: IMetricReader[] = [];
  if (options.metricReader) readers.push(options.metricReader);
  else if (plan.metrics) readers.push(new PeriodicExportingMetricReader({ exporter: new OTLPMetricExporter() }));

  const tracerProvider = new NodeTracerProvider({ resource, spanProcessors });
  tracerProvider.register();
  const meterProvider = new MeterProvider({ resource, readers });
  metrics.setGlobalMeterProvider(meterProvider);

  const unregister = registerInstrumentations({
    tracerProvider,
    meterProvider,
    // Express is not instrumented by OpenTelemetry's Express package: that hooks `require`, which an ESM
    // `import` of a CommonJS package bypasses unless a loader flag is passed to node. httpTelemetry
    // names the HTTP server span after the route instead.
    instrumentations: [new HttpInstrumentation({ ignoreIncomingRequestHook: isProbe })],
  });

  const exporting = {
    traces: options.spanExporter !== undefined || plan.traces,
    metrics: options.metricReader !== undefined || plan.metrics,
  };

  return {
    enabled: true,
    exporting,
    serviceName,
    async forceFlush() {
      await Promise.all([tracerProvider.forceFlush(), meterProvider.forceFlush()]);
    },
    async shutdown(timeoutMs = SHUTDOWN_TIMEOUT_MS) {
      unregister();
      let timer: NodeJS.Timeout | undefined;
      const giveUp = new Promise<void>((resolve) => {
        timer = setTimeout(resolve, timeoutMs);
        timer.unref();
      });
      await Promise.race([Promise.allSettled([tracerProvider.shutdown(), meterProvider.shutdown()]), giveUp]);
      clearTimeout(timer);
      trace.disable();
      metrics.disable();
      propagation.disable();
      context.disable();
    },
  };
}
