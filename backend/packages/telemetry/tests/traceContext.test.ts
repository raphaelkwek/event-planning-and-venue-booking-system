import { describe, expect, it } from "vitest";
import { context, ROOT_CONTEXT, trace } from "@opentelemetry/api";
import { startForTest } from "./support/testTelemetry.js";
import {
  activeSpanContext,
  activeTraceId,
  activeTraceparent,
  contextFromTraceparent,
  formatTraceparent,
  parseTraceparent,
  traceFields,
  withTraceFields,
} from "../src/index.js";

const TRACE_ID = "4bf92f3577b34da6a3ce929d0e0e4736";
const SPAN_ID = "00f067aa0ba902b7";
const SAMPLED = `00-${TRACE_ID}-${SPAN_ID}-01`;

describe("traceparent", () => {
  it("parses a valid header into a remote span context", () => {
    expect(parseTraceparent(SAMPLED)).toEqual({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 1, isRemote: true });
    expect(parseTraceparent(`  00-${TRACE_ID}-${SPAN_ID}-00 `)?.traceFlags).toBe(0);
  });

  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["wrong version", `01-${TRACE_ID}-${SPAN_ID}-01`],
    ["short trace id", `00-abc-${SPAN_ID}-01`],
    ["upper case", `00-${TRACE_ID.toUpperCase()}-${SPAN_ID}-01`],
    ["all-zero trace id", `00-${"0".repeat(32)}-${SPAN_ID}-01`],
    ["all-zero span id", `00-${TRACE_ID}-${"0".repeat(16)}-01`],
  ])("refuses a %s traceparent", (_name, value) => {
    expect(parseTraceparent(value)).toBeNull();
  });

  it("formats a span context back, carrying only the sampled bit", () => {
    expect(formatTraceparent({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 1 })).toBe(SAMPLED);
    expect(formatTraceparent({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 0 })).toBe(`00-${TRACE_ID}-${SPAN_ID}-00`);
    expect(formatTraceparent({ traceId: TRACE_ID, spanId: SPAN_ID, traceFlags: 3 })).toBe(SAMPLED);
  });

  it("builds a context whose active span is the remote parent, or leaves the base alone", () => {
    expect(trace.getSpanContext(contextFromTraceparent(SAMPLED))?.spanId).toBe(SPAN_ID);
    expect(contextFromTraceparent("garbage")).toBe(ROOT_CONTEXT);
    expect(contextFromTraceparent(undefined)).toBe(ROOT_CONTEXT);
  });
});

describe("the active trace", () => {
  const t = startForTest("trace-context-test");

  it("has no ids and adds nothing to a log line outside a span", () => {
    expect(activeSpanContext()).toBeUndefined();
    expect(activeTraceId()).toBeUndefined();
    expect(activeTraceparent()).toBeUndefined();
    expect(traceFields()).toEqual({});
    expect(withTraceFields({ message: "x", correlationId: null })).toEqual({ message: "x", correlationId: null });
  });

  it("EN-08-T7 puts the trace id on a log line as traceId, and as correlationId when the caller gave none", () => {
    const span = trace.getTracer("test").startSpan("work");
    context.with(trace.setSpan(context.active(), span), () => {
      const { traceId, spanId } = span.spanContext();
      expect(activeTraceId()).toBe(traceId);
      expect(activeTraceparent()).toBe(`00-${traceId}-${spanId}-01`);
      expect(withTraceFields({ message: "x" })).toEqual({ message: "x", traceId, spanId, correlationId: traceId });
      expect(withTraceFields({ message: "x", correlationId: null })).toMatchObject({ correlationId: traceId });
      expect(withTraceFields({ message: "x", correlationId: "from-the-caller" })).toMatchObject({ correlationId: "from-the-caller", traceId });
    });
    span.end();
    expect(t.finished()).toHaveLength(1);
  });
});
