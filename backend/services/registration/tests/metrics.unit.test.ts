import { describe, expect, it } from "vitest";
import request from "supertest";
import type { Sql } from "postgres";
import { Registry } from "@connectsphere/observability";
import { app } from "../src/app.js";
import { countInvariantViolations, registerOverAdmissionGauges } from "../src/overAdmission.js";

/** EN-17: registration /metrics, and the zero-over-admission gauge read from the seat table. */

/** A database stand-in whose query answers with the given rows, or fails. */
const fakeSql = (result: unknown[] | Error): Sql =>
  (() => (result instanceof Error ? Promise.reject(result) : Promise.resolve(result))) as unknown as Sql;

async function scrape(sql: Sql) {
  const registry = new Registry();
  registerOverAdmissionGauges(registry, sql);
  return registry.metrics();
}

describe("registration metrics", () => {
  it("EN-17-T2 /metrics shows the HTTP metrics and the over-admission gauge", async () => {
    await request(app).get("/healthz");
    const res = await request(app).get("/metrics");
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total{method="GET",route="/healthz",status="2xx",service="registration"} 1');
    expect(res.text).toContain("# TYPE registration_over_admission_seats gauge");
    expect(res.text).toContain("# TYPE registration_invariant_check_success gauge");
  });

  it("EN-17-T5 the gauge is 0 when the seat table is healthy", async () => {
    const text = await scrape(fakeSql([{ violations: 0 }]));
    expect(text).toContain("registration_over_admission_seats 0");
    expect(text).toContain("registration_invariant_check_success 1");
  });

  it("EN-17-T5 the gauge counts the violations the query finds", async () => {
    const text = await scrape(fakeSql([{ violations: 3 }]));
    expect(text).toContain("registration_over_admission_seats 3");
    expect(text).toContain("registration_invariant_check_success 1");
  });

  it("EN-17-T5 a failed check is reported as not run, not as zero violations", async () => {
    const text = await scrape(fakeSql(new Error("connection refused")));
    expect(text).toContain("registration_invariant_check_success 0");
  });

  it("counts an empty answer as no violations", async () => {
    expect(await countInvariantViolations(fakeSql([]))).toBe(0);
  });
});
