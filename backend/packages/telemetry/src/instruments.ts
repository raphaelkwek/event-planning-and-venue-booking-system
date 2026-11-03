import { metrics, type Counter, type Histogram, type MeterProvider } from "@opentelemetry/api";

/**
 * The metric instruments every service shares.
 *
 * The HTTP names are the ones EN-17's SLO rules and EN-16's canary analysis
 * query (documentation/slos.md, deploy/k8s/analysis/error-rate-and-p95.yaml),
 * with the same labels (`service`, `method`, `route`, `status`), so a query
 * reads the same series whether a Prometheus scrapes `/metrics` or Grafana
 * Cloud receives them over OTLP. OTLP-to-Prometheus translation turns
 * `http_request_duration_seconds` (unit s) into `http_request_duration_seconds_bucket`
 * and `http_requests_total` into itself.
 */

/**
 * Latency buckets in seconds. 0.4 and 0.8 are the staff read and write
 * objectives and the registration objective (ADR-0013), so "faster than the
 * objective" is one bucket and needs no interpolation. Identical to EN-17's.
 */
export const LATENCY_BUCKETS_SECONDS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.4, 0.8, 1.6, 3.2, 6.4];

/** Consumer-side latency spans a longer range: a retried message waits seconds, and lag can be minutes. */
const LAG_BUCKETS_SECONDS = [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 30, 60, 300];

export interface Instruments {
  httpDuration: Histogram;
  httpRequests: Counter;
  kafkaProcessing: Histogram;
  kafkaLag: Histogram;
  kafkaPublished: Counter;
}

let cached: { provider: MeterProvider; instruments: Instruments } | null = null;

/**
 * Created from whichever meter provider is registered now, and again if it is
 * replaced (a test starts its own). Without a provider the API hands back
 * no-op instruments, so recording costs nothing.
 */
export function instruments(): Instruments {
  const provider = metrics.getMeterProvider();
  if (cached?.provider === provider) return cached.instruments;

  const meter = metrics.getMeter("connectsphere");
  const created: Instruments = {
    httpDuration: meter.createHistogram("http_request_duration_seconds", {
      unit: "s",
      description: "HTTP request duration by route pattern, from arrival to the response finishing.",
      advice: { explicitBucketBoundaries: LATENCY_BUCKETS_SECONDS },
    }),
    httpRequests: meter.createCounter("http_requests_total", {
      description: "HTTP requests by route pattern and status class.",
    }),
    kafkaProcessing: meter.createHistogram("kafka_consumer_processing_duration_seconds", {
      unit: "s",
      description: "Time to handle one Kafka message, by topic, consumer group and outcome.",
      advice: { explicitBucketBoundaries: LATENCY_BUCKETS_SECONDS },
    }),
    kafkaLag: meter.createHistogram("kafka_consumer_lag_seconds", {
      unit: "s",
      description: "Seconds from a message being appended to its topic to its handling starting.",
      advice: { explicitBucketBoundaries: LAG_BUCKETS_SECONDS },
    }),
    kafkaPublished: meter.createCounter("kafka_messages_published_total", {
      description: "Messages published to Kafka, by topic and result.",
    }),
  };
  cached = { provider, instruments: created };
  return created;
}
