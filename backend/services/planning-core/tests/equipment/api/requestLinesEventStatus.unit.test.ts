import express from "express";
import type { NextFunction, Request, Response } from "express";
import type { Sql } from "postgres";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

// D4 (F4): a line of a cancelled event must say so. The list carries each line's event status, read
// through the event module, so Technical Support's screen can show the line as released and hide its actions.
const { role } = vi.hoisted(() => ({ role: { current: "TECH_SUPPORT_STAFF" } }));
vi.mock("../../../src/modules/equipment/auth/actor.js", () => ({
  authenticate: [(req: Request & { actor?: unknown }, _res: Response, next: NextFunction) => { req.actor = { userId: "u1", role: role.current }; next(); }],
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));
vi.mock("../../../src/modules/equipment/repo/requestLines.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/modules/equipment/repo/requestLines.js")>()),
  listLines: vi.fn(),
}));
vi.mock("../../../src/modules/event/index.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../../src/modules/event/index.js")>()),
  findEventForPlanning: vi.fn(),
  findEventStatuses: vi.fn(),
}));
const { listLines } = await import("../../../src/modules/equipment/repo/requestLines.js");
const { findEventForPlanning, findEventStatuses } = await import("../../../src/modules/event/index.js");
const { requestLinesRouter } = await import("../../../src/modules/equipment/api/requestLines.js");

const CANCELLED = "e1000000-0000-4000-8000-000000000017";
const LIVE = "e1000000-0000-4000-8000-000000000016";
const lineOf = (id: string, eventId: string, seq: number) => ({ id, seq, eventId, eventReference: `REF-${seq}`, status: "CONFIRMED" });

const app = express();
app.use(requestLinesRouter({} as Sql, (_req, _res, next) => next()));

beforeEach(() => {
  vi.clearAllMocks();
  role.current = "TECH_SUPPORT_STAFF";
});

describe("D4 the request line list names each line's event status", () => {
  it("marks a cancelled event's line and leaves the live event's line alone", async () => {
    vi.mocked(listLines).mockResolvedValue([lineOf("l1", CANCELLED, 1), lineOf("l2", LIVE, 2)] as never);
    vi.mocked(findEventStatuses).mockResolvedValue(new Map([[CANCELLED, "CANCELLED"], [LIVE, "PLANNING"]]));

    const response = await request(app).get("/api/v1/equipment/request-lines");

    expect(response.status).toBe(200);
    expect(response.body.items.map((item: { id: string; eventStatus: string }) => [item.id, item.eventStatus])).toEqual([
      ["l1", "CANCELLED"],
      ["l2", "PLANNING"],
    ]);
    expect(vi.mocked(findEventStatuses).mock.calls[0]![1]).toEqual([CANCELLED, LIVE]);
  });

  it("gives one event's lines that event's status without a second lookup", async () => {
    role.current = "TECH_SUPPORT_STAFF";
    vi.mocked(findEventForPlanning).mockResolvedValue({ id: CANCELLED, reference: "REF-1", name: "E", status: "CANCELLED", proposedStartAt: null, proposedEndAt: null, assignedCoordinatorId: null } as never);
    vi.mocked(listLines).mockResolvedValue([lineOf("l1", CANCELLED, 1)] as never);

    const response = await request(app).get("/api/v1/equipment/request-lines").query({ eventId: CANCELLED });

    expect(response.status).toBe(200);
    expect(response.body.items[0].eventStatus).toBe("CANCELLED");
    expect(findEventStatuses).not.toHaveBeenCalled();
  });

  it("reports a null status for a line whose event cannot be found", async () => {
    vi.mocked(listLines).mockResolvedValue([lineOf("l1", CANCELLED, 1)] as never);
    vi.mocked(findEventStatuses).mockResolvedValue(new Map());

    const response = await request(app).get("/api/v1/equipment/request-lines");

    expect(response.body.items[0].eventStatus).toBeNull();
  });
});
