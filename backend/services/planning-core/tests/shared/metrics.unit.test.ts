import { describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";

/** EN-17: planning-core times every route and serves /metrics. */

describe("planning-core metrics", () => {
  it("EN-17-T1 /metrics shows duration and count for a route that answered, and for an unknown path", async () => {
    await request(app).get("/healthz");
    await request(app).get("/no/such/route");
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total{method="GET",route="/healthz",status="2xx",service="planning-core"} 1');
    expect(res.text).toContain('route="unmatched",status="4xx",service="planning-core"} 1');
    expect(res.text).toContain("http_request_duration_seconds_bucket");
  });
});
