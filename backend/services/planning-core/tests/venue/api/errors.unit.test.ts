import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { fieldsFromZod, refuse } from "../../../src/modules/venue/api/errors.js";

/** The venue module's error envelope (implementation.md §5), without a database. */

function refusingApp(withCorrelationId: boolean, fields?: { field: string; message: string }[]) {
  const app = express();
  app.get("/", (_req, res) => {
    if (withCorrelationId) res.setHeader("x-correlation-id", "corr-1");
    refuse(res, 400, "VALIDATION_FAILED", "Check the highlighted fields.", fields);
  });
  return app;
}

describe("refuse", () => {
  it("sends the envelope with the request's correlation id and every field", async () => {
    const res = await request(refusingApp(true, [{ field: "to", message: "Too long." }])).get("/");
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_FAILED",
        message: "Check the highlighted fields.",
        fields: [{ field: "to", message: "Too long." }],
        correlationId: "corr-1",
      },
    });
  });

  it("leaves fields out when there are none, and sends a null correlation id when there is none", async () => {
    const res = await request(refusingApp(false)).get("/");
    expect(res.body).toEqual({
      error: { code: "VALIDATION_FAILED", message: "Check the highlighted fields.", correlationId: null },
    });
  });
});

describe("fieldsFromZod", () => {
  it("names each failing field by its path, and the body itself as `body`", () => {
    const nested = z.object({ layouts: z.array(z.object({ capacity: z.number() })) }).safeParse({ layouts: [{ capacity: "x" }] });
    const whole = z.object({}).safeParse("not an object");

    expect(fieldsFromZod(nested.error!)).toEqual([{ field: "layouts.0.capacity", message: "Expected number, received string" }]);
    expect(fieldsFromZod(whole.error!)).toEqual([{ field: "body", message: "Expected object, received string" }]);
  });
});
