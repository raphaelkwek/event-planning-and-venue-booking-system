import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { Sql } from "postgres";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../../src/modules/equipment/auth/actor.js", () => ({ authenticate: [(_req: Request,_res: Response,next: NextFunction) => next()], requireRole: () => (_req: Request,_res: Response,next: NextFunction) => next() }));
vi.mock("../../../src/modules/equipment/repo/checkAvailability.js", () => ({ checkEquipmentAvailability: vi.fn(), listAvailabilityTypes: vi.fn() }));
const { checkEquipmentAvailability, listAvailabilityTypes } = await import("../../../src/modules/equipment/repo/checkAvailability.js");
const { availabilityRouter } = await import("../../../src/modules/equipment/api/availability.js");
const query={startsAt:"2026-12-01T09:00:00Z",endsAt:"2026-12-01T10:00:00Z",requestedQuantity:"1"};
const begin=vi.fn(async (callback: (tx: unknown) => unknown) => callback({}));
const app=express(); app.use(availabilityRouter({begin} as unknown as Sql));
app.use((error: Error, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) { next(error); return; }
  res.status(500).json({ message: error.message });
});
afterEach(() => vi.clearAllMocks());
describe("P1 unexpected database defects", () => {
  it("passes catalogue SQL errors to error middleware", async () => {
    vi.mocked(listAvailabilityTypes).mockRejectedValue(new Error("catalogue defect"));
    const response=await request(app).get("/api/v1/equipment/types");
    expect(response.status).toBe(500); expect(response.body).toEqual({message:"catalogue defect"});
  });
  it("passes transactional check SQL errors to error middleware", async () => {
    vi.mocked(checkEquipmentAvailability).mockRejectedValue(new Error("check defect"));
    const response=await request(app).get("/api/v1/equipment/types/a8888888-0000-0000-0000-000000000011/availability").query(query);
    expect(response.status).toBe(500); expect(response.body).toEqual({message:"check defect"});
  });
  it("refuses malformed IDs without entering a transaction", async () => {
    const response=await request(app).get("/api/v1/equipment/types/invalid/availability").query(query);
    expect(response.status).toBe(404); expect(response.body.error.code).toBe("EQUIPMENT_TYPE_NOT_FOUND"); expect(begin).not.toHaveBeenCalled();
  });
});
