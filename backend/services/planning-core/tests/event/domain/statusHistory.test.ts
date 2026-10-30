import { describe, expect, it } from "vitest";
import { ROLES } from "@connectsphere/contracts";
import {
  canViewHistory,
  HISTORY_ROLES,
  toHistoryEntry,
  toStatusView,
} from "../../../src/modules/event/domain/statusHistory.js";

describe("who may read an event's status history (F2)", () => {
  it.each([
    ["EVENT_ORGANISER", true],
    ["EVENT_COORDINATOR", true],
    ["VENUE_STAFF", false],
    ["TECH_SUPPORT_STAFF", false],
    ["ATTENDEE", false],
    // E5 gives the Lead each event's assignment history, not its status history.
    ["EVENT_COORDINATOR_LEAD", false],
  ] as const)("%s: %s", (role, allowed) => {
    expect(canViewHistory(role)).toBe(allowed);
  });

  it("covers every role, so a new role has to be decided here", () => {
    expect(ROLES.filter(canViewHistory)).toEqual([...HISTORY_ROLES]);
    expect(ROLES).toHaveLength(6);
  });
});

describe("a history entry (F2)", () => {
  it("carries both statuses, the actor, the role, the action and an ISO timestamp", () => {
    const entry = toHistoryEntry({
      id: "e1",
      previousStatus: "SUBMITTED",
      newStatus: "UNDER_REVIEW",
      actorUserId: "u1",
      actorRole: "EVENT_COORDINATOR",
      triggeringAction: "OPEN_FOR_REVIEW",
      occurredAt: new Date("2026-10-01T02:03:04.000Z"),
    });

    expect(entry).toEqual({
      id: "e1",
      previousStatus: "SUBMITTED",
      newStatus: "UNDER_REVIEW",
      actorUserId: "u1",
      actorRole: "EVENT_COORDINATOR",
      triggeringAction: "OPEN_FOR_REVIEW",
      occurredAt: "2026-10-01T02:03:04.000Z",
    });
  });

  it("keeps a system change's missing actor and a first entry's missing previous status", () => {
    const entry = toHistoryEntry({
      id: "e2",
      previousStatus: null,
      newStatus: "COMPLETED",
      actorUserId: null,
      actorRole: "SYSTEM",
      triggeringAction: "COMPLETE",
      occurredAt: new Date(0),
    });
    expect(entry.previousStatus).toBeNull();
    expect(entry.actorUserId).toBeNull();
  });
});

describe("the status view every reader gets (F2)", () => {
  it("is the event id and status and nothing else", () => {
    const view = toStatusView({
      id: "ev1",
      status: "REJECTED",
      rejectionReason: "No suitable venue",
      reviewingCoordinatorId: "c1",
    } as { id: string; status: "REJECTED" });

    expect(view).toStrictEqual({ eventId: "ev1", status: "REJECTED" });
  });
});
