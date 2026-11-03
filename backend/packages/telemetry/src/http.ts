import { randomUUID } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { trace } from "@opentelemetry/api";
import { activeTraceId } from "./traceContext.js";
import { instruments } from "./instruments.js";

/** The route label of a request that matched no route. SLIs can exclude it (EN-17 does). */
export const UNMATCHED_ROUTE = "unmatched";

export const CORRELATION_HEADER = "x-correlation-id";

/** `2xx`, `4xx`, `5xx`: the label EN-17's availability SLI counts on. */
export const statusClass = (status: number) => `${Math.floor(status / 100)}xx`;

/** The route pattern ("/api/v1/events/:id/approve"), never the raw URL, so ids cannot create series. */
export function routeLabel(req: Pick<Request, "baseUrl" | "route">): string {
  const pattern = (req.route as { path?: unknown } | undefined)?.path;
  return typeof pattern === "string" ? `${req.baseUrl ?? ""}${pattern}` : UNMATCHED_ROUTE;
}

/**
 * The request's correlation id. It is the active trace id (ADR-0013): the HTTP
 * instrumentation has already opened the server span, continuing an incoming
 * `traceparent` when there was one, so the id on the response, in the logs and
 * in every message the request produces is the id Tempo shows. With no trace
 * (the SDK is off, or this is a unit test) a caller's own id is kept, else a UUID.
 */
export function correlationIdFor(incoming: string | undefined): string {
  return activeTraceId() ?? (incoming?.trim() ? incoming.trim() : randomUUID());
}

export interface HttpTelemetryOptions {
  /** The `service` label on every series: planning-core, notification, registration. */
  service: string;
}

/**
 * Mount first, so every route and every refusal is timed and carries an id.
 *
 * 1. Sets `x-correlation-id` on the request (for the code that reads it to fill
 *    an outbox row or an error envelope) and on the response.
 * 2. When the response finishes, names the HTTP server span after the Express route
 *    that handled it, `POST /api/v1/events/:id/approve`, sets `http.route`, and records
 *    the request's duration and count. OpenTelemetry's Express instrumentation would
 *    name the span, but it hooks `require`, which the ESM services bypass (see sdk.ts).
 *    The HTTP instrumentation ends the server span on the response's `close` event,
 *    which comes after `finish`, so the span can still be renamed here (tested in
 *    http.test.ts, EN-08-T1, against the pinned version).
 *
 * Health probes are not traced but are counted in `http_requests_total`, under their
 * own routes; EN-17's SLIs exclude `/healthz`, `/readyz` and `/metrics` by route.
 */
export function httpTelemetry(options: HttpTelemetryOptions): RequestHandler {
  return (req, res, next) => {
    const incoming = req.header(CORRELATION_HEADER);
    const correlationId = correlationIdFor(incoming);
    const serverSpan = trace.getActiveSpan();
    if (incoming && incoming !== correlationId) {
      // A caller-chosen id is not lost: it stays searchable on the server span.
      serverSpan?.setAttribute("connectsphere.client_correlation_id", incoming.slice(0, 200));
    }
    req.headers[CORRELATION_HEADER] = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);

    const startedAt = process.hrtime.bigint();
    res.once("finish", () => {
      const route = routeLabel(req);
      if (serverSpan && route !== UNMATCHED_ROUTE) {
        serverSpan.setAttribute("http.route", route);
        serverSpan.updateName(`${req.method} ${route}`);
      }
      const attributes = {
        service: options.service,
        method: req.method,
        route,
        status: statusClass(res.statusCode),
      };
      const { httpDuration, httpRequests } = instruments();
      httpDuration.record(Number(process.hrtime.bigint() - startedAt) / 1e9, attributes);
      httpRequests.add(1, attributes);
    });
    next();
  };
}
