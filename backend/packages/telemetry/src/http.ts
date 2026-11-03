import { randomUUID } from "node:crypto";
import type { Request, RequestHandler, Response } from "express";
import { trace, type Span } from "@opentelemetry/api";
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

/**
 * Names the HTTP server span after the Express route that handled the request,
 * `POST /api/v1/events/:id/approve`, and sets `http.route`. OpenTelemetry's
 * Express instrumentation would do this, but it hooks `require`, which the ESM
 * services bypass (see sdk.ts). It must happen before the response ends,
 * because the HTTP instrumentation ends the server span inside `res.end`.
 */
function nameServerSpanOnEnd(span: Span | undefined, req: Request, res: Response): void {
  if (!span) return;
  const end = res.end;
  res.end = function patchedEnd(this: Response, ...args: unknown[]) {
    const route = routeLabel(req);
    if (route !== UNMATCHED_ROUTE) {
      span.setAttribute("http.route", route);
      span.updateName(`${req.method} ${route}`);
    }
    return (end as (...a: unknown[]) => Response).apply(this, args);
  } as Response["end"];
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
 * 2. Records the request's duration and count when the response finishes.
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
    nameServerSpanOnEnd(serverSpan, req, res);
    req.headers[CORRELATION_HEADER] = correlationId;
    res.setHeader(CORRELATION_HEADER, correlationId);

    const startedAt = process.hrtime.bigint();
    res.on("finish", () => {
      const attributes = {
        service: options.service,
        method: req.method,
        route: routeLabel(req),
        status: statusClass(res.statusCode),
      };
      const { httpDuration, httpRequests } = instruments();
      httpDuration.record(Number(process.hrtime.bigint() - startedAt) / 1e9, attributes);
      httpRequests.add(1, attributes);
    });
    next();
  };
}
