import { describe, expect, it } from "vitest";
import { exportPlan, isSdkDisabled } from "../src/index.js";

describe("what leaves the process", () => {
  it("EN-08-T8 exports nothing, and attempts nothing, when no endpoint is set", () => {
    expect(exportPlan({})).toEqual({ traces: false, metrics: false });
    expect(exportPlan({ OTEL_EXPORTER_OTLP_ENDPOINT: "   " })).toEqual({ traces: false, metrics: false });
  });

  it("EN-08-T9 exports both signals when the shared OTLP endpoint is set", () => {
    expect(exportPlan({ OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp-gateway.example/otlp" })).toEqual({ traces: true, metrics: true });
  });

  it("EN-08-T9 exports only the signal whose own endpoint is set", () => {
    expect(exportPlan({ OTEL_EXPORTER_OTLP_TRACES_ENDPOINT: "https://t.example/v1/traces" })).toEqual({ traces: true, metrics: false });
    expect(exportPlan({ OTEL_EXPORTER_OTLP_METRICS_ENDPOINT: "https://m.example/v1/metrics" })).toEqual({ traces: false, metrics: true });
  });

  it("EN-08-T9 turns one signal off with the standard OTEL_*_EXPORTER=none", () => {
    const env = { OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp-gateway.example/otlp" };
    expect(exportPlan({ ...env, OTEL_METRICS_EXPORTER: "none" })).toEqual({ traces: true, metrics: false });
    expect(exportPlan({ ...env, OTEL_TRACES_EXPORTER: " NONE " })).toEqual({ traces: false, metrics: true });
  });

  it("EN-08-T8 OTEL_SDK_DISABLED switches everything off, whatever else is set", () => {
    const env = { OTEL_EXPORTER_OTLP_ENDPOINT: "https://otlp-gateway.example/otlp", OTEL_SDK_DISABLED: "TRUE" };
    expect(isSdkDisabled(env)).toBe(true);
    expect(exportPlan(env)).toEqual({ traces: false, metrics: false });
    expect(isSdkDisabled({ OTEL_SDK_DISABLED: "false" })).toBe(false);
    expect(isSdkDisabled({})).toBe(false);
  });
});
