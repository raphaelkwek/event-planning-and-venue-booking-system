import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { context, trace } from "@opentelemetry/api";
import { activeTraceId, instruments, startTelemetry, type Telemetry } from "../src/index.js";

/**
 * EN-08-T8 and T9: what the SDK does with the standard OTEL_* variables. A local HTTP server
 * stands in for Grafana Cloud's OTLP gateway, so the export is real, over HTTP, with protobuf bodies.
 */

interface Received {
  url: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

let receiver: http.Server;
let received: Received[] = [];
let endpoint = "";

beforeAll(async () => {
  receiver = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      received.push({ url: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
      res.writeHead(200, { "content-type": "application/x-protobuf" }).end();
    });
  });
  await new Promise<void>((resolve) => receiver.listen(0, "127.0.0.1", resolve));
  endpoint = `http://127.0.0.1:${(receiver.address() as AddressInfo).port}/otlp`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => receiver.close(() => resolve()));
});

let running: Telemetry | undefined;

afterEach(async () => {
  await running?.shutdown();
  running = undefined;
  received = [];
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const anySpan = () => {
  const span = trace.getTracer("sdk-test").startSpan("one approval");
  span.end();
};

const bodyHas = (r: Received, text: string) => r.body.includes(Buffer.from(text));

describe("with an OTLP endpoint in the standard variables", () => {
  it("EN-08-T9 sends traces to <endpoint>/v1/traces with the OTEL_EXPORTER_OTLP_HEADERS and the resource attributes", async () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint);
    vi.stubEnv("OTEL_EXPORTER_OTLP_HEADERS", "Authorization=Basic%20Zm9vOmJhcg==,X-Scope=tenant-7");
    vi.stubEnv("OTEL_RESOURCE_ATTRIBUTES", "deployment.environment=staging-test");
    vi.stubEnv("OTEL_SERVICE_NAME", "svc-from-env");

    running = startTelemetry({ serviceName: "svc-default" });
    expect(running.exporting).toEqual({ traces: true, metrics: true });
    expect(running.serviceName).toBe("svc-from-env");

    anySpan();
    await running.forceFlush();

    const traces = received.filter((r) => r.url === "/otlp/v1/traces");
    expect(traces).toHaveLength(1);
    expect(traces[0]!.headers.authorization).toBe("Basic Zm9vOmJhcg==");
    expect(traces[0]!.headers["x-scope"]).toBe("tenant-7");
    expect(traces[0]!.headers["content-type"]).toBe("application/x-protobuf");
    expect(bodyHas(traces[0]!, "svc-from-env")).toBe(true);
    expect(bodyHas(traces[0]!, "deployment.environment")).toBe(true);
    expect(bodyHas(traces[0]!, "staging-test")).toBe(true);
    expect(bodyHas(traces[0]!, "one approval")).toBe(true);
  });

  it("EN-08-T9 sends metrics to <endpoint>/v1/metrics, with the HTTP histogram EN-17 queries", async () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint);
    running = startTelemetry({ serviceName: "svc-default" });

    instruments().httpRequests.add(1, { service: "svc-default", method: "GET", route: "/x", status: "2xx" });
    instruments().httpDuration.record(0.2, { service: "svc-default", method: "GET", route: "/x", status: "2xx" });
    await running.forceFlush();

    const metrics = received.filter((r) => r.url === "/otlp/v1/metrics");
    expect(metrics.length).toBeGreaterThanOrEqual(1);
    expect(bodyHas(metrics[0]!, "http_requests_total")).toBe(true);
    expect(bodyHas(metrics[0]!, "http_request_duration_seconds")).toBe(true);
    expect(bodyHas(metrics[0]!, "svc-default")).toBe(true);
  });

  it("EN-08-T9 sends only the signal that has its own endpoint, and none that is switched off", async () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_TRACES_ENDPOINT", `${endpoint}/v1/traces`);
    running = startTelemetry({ serviceName: "svc-default" });
    expect(running.exporting).toEqual({ traces: true, metrics: false });
    anySpan();
    await running.forceFlush();
    expect(received.map((r) => r.url)).toEqual(["/otlp/v1/traces"]);
  });
});

describe("with no OTLP endpoint", () => {
  it("EN-08-T8 exports nothing, opens no connection and prints nothing, yet still makes trace ids", async () => {
    const request = vi.spyOn(http, "request");
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const write = vi.spyOn(process.stderr, "write");

    running = startTelemetry({ serviceName: "quiet", env: {} });
    expect(running.enabled).toBe(true);
    expect(running.exporting).toEqual({ traces: false, metrics: false });

    const span = trace.getTracer("quiet").startSpan("work");
    context.with(trace.setSpan(context.active(), span), () => {
      // The correlation id and the Kafka traceparent still work on a laptop with no Grafana account.
      expect(activeTraceId()).toMatch(/^[0-9a-f]{32}$/);
    });
    span.end();
    await running.forceFlush();
    await running.shutdown();
    running = undefined;

    expect(request).not.toHaveBeenCalled();
    expect(received).toHaveLength(0);
    for (const spy of [log, warn, error, write]) expect(spy).not.toHaveBeenCalled();
  });

  it("EN-08-T8 installs nothing at all with OTEL_SDK_DISABLED=true, even with an endpoint", async () => {
    vi.stubEnv("OTEL_EXPORTER_OTLP_ENDPOINT", endpoint);
    vi.stubEnv("OTEL_SDK_DISABLED", "true");

    running = startTelemetry({ serviceName: "off" });
    expect(running.enabled).toBe(false);
    expect(running.exporting).toEqual({ traces: false, metrics: false });
    expect(running.serviceName).toBe("off");

    const span = trace.getTracer("off").startSpan("work");
    context.with(trace.setSpan(context.active(), span), () => {
      expect(activeTraceId()).toBeUndefined();
    });
    span.end();
    await running.forceFlush();
    await running.shutdown();
    expect(received).toHaveLength(0);
  });

  it("EN-08-T8 gives up on a collector that never answers, so a pod's shutdown is not held past its grace period", async () => {
    const hanging = { export: (_spans: unknown, done: (result: { code: number }) => void) => done({ code: 0 }), shutdown: () => new Promise<void>(() => undefined), forceFlush: async () => undefined };
    running = startTelemetry({ serviceName: "stuck", env: {}, spanExporter: hanging as never });
    const startedAt = Date.now();
    await running.shutdown(50);
    running = undefined;
    expect(Date.now() - startedAt).toBeLessThan(2000);
  });

  it("EN-08-T8 names the service from the caller when OTEL_SERVICE_NAME is not set", () => {
    running = startTelemetry({ serviceName: "named-by-caller", env: {} });
    expect(running.serviceName).toBe("named-by-caller");
  });
});
