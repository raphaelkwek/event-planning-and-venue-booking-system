import express from "express";
import request from "supertest";
import { describe, expect, test } from "vitest";
import { createServiceMetrics, routeLabel, UNMATCHED_ROUTE } from "../src/metrics.js";

function appWith(options: Parameters<typeof createServiceMetrics>[0]) {
  const metrics = createServiceMetrics({ defaultMetrics: false, ...options });
  const app = express();
  app.use(metrics.middleware);
  app.get("/api/v1/things/:id", (req, res) => res.json({ id: req.params.id }));
  app.post("/api/v1/things", (_req, res) => res.status(500).json({ error: "boom" }));
  const sub = express.Router();
  sub.get("/inner", (_req, res) => res.json({}));
  app.use("/api/v1/sub", sub);
  app.use(metrics.router);
  return { app, metrics };
}

describe("EN-17-T1 request duration and count by route pattern", () => {
  test("EN-17-T1 records a matched GET, a failing POST and an unknown path", async () => {
    const { app } = appWith({ service: "planning-core" });
    await request(app).get("/api/v1/things/11111111-1111-1111-1111-111111111111");
    await request(app).get("/api/v1/things/22222222-2222-2222-2222-222222222222");
    await request(app).post("/api/v1/things");
    await request(app).get("/no/such/path");
    await request(app).get("/api/v1/sub/inner");

    const text = (await request(app).get("/metrics")).text;
    expect(text).toContain('http_requests_total{method="GET",route="/api/v1/things/:id",status="2xx",service="planning-core"} 2');
    expect(text).toContain('http_requests_total{method="POST",route="/api/v1/things",status="5xx",service="planning-core"} 1');
    expect(text).toContain(`http_requests_total{method="GET",route="${UNMATCHED_ROUTE}",status="4xx",service="planning-core"} 1`);
    expect(text).toContain('route="/api/v1/sub/inner"');
    expect(text).not.toContain("11111111-1111");
    expect(text).toContain('http_request_duration_seconds_bucket{le="0.8",service="planning-core",method="GET",route="/api/v1/things/:id",status="2xx"} 2');
    expect(text).toContain('http_request_duration_seconds_bucket{le="0.4"');
    expect(text).toContain("http_request_duration_seconds_count");
  });

  test("EN-17-T1 the default process metrics are collected unless switched off", async () => {
    const app = express();
    const metrics = createServiceMetrics({ service: "x" });
    app.use(metrics.router);
    expect((await request(app).get("/metrics")).text).toContain("process_cpu_user_seconds_total");
  });

  test("routeLabel falls back to unmatched and tolerates a missing baseUrl", () => {
    expect(routeLabel({ route: undefined } as never)).toBe(UNMATCHED_ROUTE);
    expect(routeLabel({ route: { path: "/a" } } as never)).toBe("/a");
  });
});

describe("EN-17-T4 /metrics access", () => {
  test("EN-17-T4 a token is required when one is set", async () => {
    const { app } = appWith({ service: "s", token: "scrape-secret" });
    expect((await request(app).get("/metrics")).status).toBe(401);
    expect((await request(app).get("/metrics").set("Authorization", "Bearer wrong-secret")).status).toBe(401);
    expect((await request(app).get("/metrics").set("Authorization", "Bearer short")).status).toBe(401);
    expect((await request(app).get("/metrics").set("Authorization", "Bearer scrape-secret")).status).toBe(200);
  });

  test("EN-17-T4 the third request in a window of two is refused with RATE_LIMITED", async () => {
    const { app } = appWith({ service: "s", limitPerMinute: 2 });
    expect((await request(app).get("/metrics")).status).toBe(200);
    expect((await request(app).get("/metrics")).status).toBe(200);
    const refused = await request(app).get("/metrics");
    expect(refused.status).toBe(429);
    expect(refused.body.error.code).toBe("RATE_LIMITED");
  });

  test("EN-17-T4 production without a token switches the endpoint off", async () => {
    const off = appWith({ service: "s", production: true });
    expect((await request(off.app).get("/metrics")).status).toBe(404);
    const on = appWith({ service: "s", production: true, token: "t-token-1" });
    expect((await request(on.app).get("/metrics").set("Authorization", "Bearer t-token-1")).status).toBe(200);
  });

  test("a registry failure goes to the error handler instead of an unhandled rejection", async () => {
    const { app, metrics } = appWith({ service: "s" });
    metrics.registry.metrics = () => Promise.reject(new Error("collect failed"));
    // Express recognises an error handler by its four parameters.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    app.use((_err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      res.status(500).json({ error: "handled" });
    });
    expect((await request(app).get("/metrics")).status).toBe(500);
  });
});
