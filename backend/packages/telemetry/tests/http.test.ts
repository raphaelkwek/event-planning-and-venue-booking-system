import { describe, expect, it } from "vitest";
import { SpanKind } from "@opentelemetry/api";
import { parentIdOf, startForTest } from "./support/testTelemetry.js";

// The SDK first, then express: the HTTP instrumentation patches `http` as it loads.
const t = startForTest("http-test");
const { default: express } = await import("express");
const { default: request } = await import("supertest");
const { default: postgres } = await import("postgres");
const { httpTelemetry, instrumentSql, routeLabel, statusClass, UNMATCHED_ROUTE } = await import("../src/index.js");

/** A real postgres.js whose address refuses, so a query fails fast and no database is needed. */
const sql = instrumentSql(postgres("postgres://ci:ci@127.0.0.1:1/none", { max: 1, connect_timeout: 1, prepare: false }));

function appUnderTest() {
  const app = express();
  app.use(httpTelemetry({ service: "http-test" }));
  app.get("/things/:id", async (_req, res) => {
    try {
      await sql`select id from event.events where id = ${"secret-value"}`;
      res.json({});
    } catch {
      res.status(503).json({ error: "database unavailable" });
    }
  });
  app.get("/ok", (_req, res) => {
    res.json({ ok: true });
  });
  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok" });
  });
  return app;
}

const serverSpans = () => t.finished().filter((s) => s.kind === SpanKind.SERVER);

describe("an HTTP request", () => {
  it("EN-08-T1 makes a server span named after its route pattern, with the database query as its child", async () => {
    t.spans.reset();
    const res = await request(appUnderTest()).get("/things/42");
    expect(res.status).toBe(503);

    const [server] = serverSpans();
    expect(server!.name).toBe("GET /things/:id");
    expect(server!.attributes["http.route"]).toBe("/things/:id");
    expect(server!.attributes["http.response.status_code"]).toBe(503);

    const [query] = t.byName("SELECT event.events");
    expect(query).toBeDefined();
    expect(query!.kind).toBe(SpanKind.CLIENT);
    expect(parentIdOf(query!)).toBe(server!.spanContext().spanId);
    expect(query!.spanContext().traceId).toBe(server!.spanContext().traceId);
  });

  it("EN-08-T2 records a statement's text with placeholders, never the values", async () => {
    t.spans.reset();
    await request(appUnderTest()).get("/things/7");
    const [query] = t.byName("SELECT event.events");
    expect(query!.attributes["db.query.text"]).toBe("select id from event.events where id = $1");
    expect(JSON.stringify(query!.attributes)).not.toContain("secret-value");
    expect(query!.status.code).toBe(2);
    expect(query!.attributes["db.response.status_code"]).toBe("ECONNREFUSED");
  });

  it("EN-08-T6 answers with the trace id as x-correlation-id", async () => {
    t.spans.reset();
    const res = await request(appUnderTest()).get("/ok");
    const [server] = serverSpans();
    expect(res.headers["x-correlation-id"]).toBe(server!.spanContext().traceId);
    expect(res.headers["x-correlation-id"]).toMatch(/^[0-9a-f]{32}$/);
  });

  it("EN-08-T6 continues an incoming traceparent: the correlation id is that trace's id", async () => {
    t.spans.reset();
    const traceId = "4bf92f3577b34da6a3ce929d0e0e4736";
    const res = await request(appUnderTest())
      .get("/ok")
      .set("traceparent", `00-${traceId}-00f067aa0ba902b7-01`);
    const [server] = serverSpans();
    expect(res.headers["x-correlation-id"]).toBe(traceId);
    expect(server!.spanContext().traceId).toBe(traceId);
    expect(parentIdOf(server!)).toBe("00f067aa0ba902b7");
  });

  it("EN-08-T6 keeps a caller's own x-correlation-id on the span, but the trace id is the correlation id", async () => {
    t.spans.reset();
    const res = await request(appUnderTest()).get("/ok").set("x-correlation-id", "client-chosen-id");
    const [server] = serverSpans();
    expect(res.headers["x-correlation-id"]).toBe(server!.spanContext().traceId);
    expect(server!.attributes["connectsphere.client_correlation_id"]).toBe("client-chosen-id");
  });

  it("EN-08-T1 makes no trace for a health probe", async () => {
    t.spans.reset();
    const res = await request(appUnderTest()).get("/healthz");
    expect(res.status).toBe(200);
    expect(serverSpans()).toHaveLength(0);
    // The probe is still answered with an id, from a UUID, since there is no trace.
    expect(res.headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("EN-08-T1 leaves an unmatched route's span with its plain name, so a scan cannot create span names", async () => {
    t.spans.reset();
    const res = await request(appUnderTest()).get("/no/such/route");
    expect(res.status).toBe(404);
    const [server] = serverSpans();
    expect(server!.name).toBe("GET");
    expect(server!.attributes["http.route"]).toBeUndefined();
  });
});

describe("the HTTP metrics", () => {
  it("EN-08-T10 record http_request_duration_seconds and http_requests_total with EN-17's labels", async () => {
    // The instruments are cumulative across this file's earlier requests, so compare before and after.
    const countBy = async (name: string) =>
      new Map(
        ((await t.metric(name))?.dataPoints ?? []).map((p) => [
          `${p.attributes.route}|${p.attributes.status}|${p.attributes.service}|${p.attributes.method}`,
          typeof p.value === "number" ? p.value : (p.value as { count: number }).count,
        ]),
      );
    const before = { duration: await countBy("http_request_duration_seconds"), total: await countBy("http_requests_total") };

    await request(appUnderTest()).get("/things/1");
    await request(appUnderTest()).get("/ok");
    await request(appUnderTest()).get("/ok");

    expect((await t.metric("http_request_duration_seconds"))!.descriptor.unit).toBe("s");
    const after = { duration: await countBy("http_request_duration_seconds"), total: await countBy("http_requests_total") };
    const failing = "/things/:id|5xx|http-test|GET";
    const fine = "/ok|2xx|http-test|GET";
    for (const name of ["duration", "total"] as const) {
      expect(after[name].get(failing)! - (before[name].get(failing) ?? 0)).toBe(1);
      expect(after[name].get(fine)! - (before[name].get(fine) ?? 0)).toBe(2);
    }
  });

  it("EN-08-T10 count request durations in buckets that include 0.4 s and 0.8 s, the objectives", async () => {
    await request(appUnderTest()).get("/ok");
    const duration = await t.metric("http_request_duration_seconds");
    const boundaries = (duration!.dataPoints[0]!.value as { buckets: { boundaries: number[] } }).buckets.boundaries;
    expect(boundaries).toContain(0.4);
    expect(boundaries).toContain(0.8);
  });
});

describe("route labels", () => {
  it("joins a mounted router's path to its pattern", () => {
    expect(routeLabel({ baseUrl: "/api/v1", route: { path: "/events/:id" } } as never)).toBe("/api/v1/events/:id");
    expect(routeLabel({ baseUrl: "", route: { path: "/healthz" } } as never)).toBe("/healthz");
  });

  it("is 'unmatched' when no route matched, or the pattern is a regular expression", () => {
    expect(routeLabel({ baseUrl: "", route: undefined } as never)).toBe(UNMATCHED_ROUTE);
    expect(routeLabel({ baseUrl: "", route: { path: /^\/x/ } } as never)).toBe(UNMATCHED_ROUTE);
  });

  it("classes a status as 2xx, 4xx or 5xx", () => {
    expect([200, 204, 302, 404, 429, 500, 503].map(statusClass)).toEqual(["2xx", "2xx", "3xx", "4xx", "4xx", "5xx", "5xx"]);
  });
});
