import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { httpTelemetry } from "../src/index.js";

/** No SDK is started in this file: the process behaves as it did before EN-08. */
describe("an HTTP request when no SDK is running", () => {
  const app = express().use(httpTelemetry({ service: "no-sdk" }));
  app.get("/ok", (req, res) => {
    res.json({ seen: req.header("x-correlation-id") });
  });

  it("EN-08-T8 keeps a caller's x-correlation-id, on the response and for the code that reads it", async () => {
    const res = await request(app).get("/ok").set("x-correlation-id", "caller-1");
    expect(res.headers["x-correlation-id"]).toBe("caller-1");
    expect(res.body.seen).toBe("caller-1");
  });

  it("EN-08-T8 makes a UUID when there is neither a trace nor a caller's id", async () => {
    const res = await request(app).get("/ok");
    expect(res.headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/);
    const blank = await request(app).get("/ok").set("x-correlation-id", "   ");
    expect(blank.headers["x-correlation-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
