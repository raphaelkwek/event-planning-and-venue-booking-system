import { describe, expect, it } from "vitest";
import { notificationsFor, type NotifiableEvent } from "../../src/domain/recipients.js";

/**
 * T2's recipient rules, from the facts each message carries (EN-04.3). Each
 * trigger is an acceptance criterion on the story that raises it: B1, D2–D5,
 * E1, E2. Only users the message names, in their role on the event, are
 * notified, so nobody unrelated to the event ever is (T2 AC2).
 */

const eventId = "6f1c2a4e-8b1d-4c3a-9e2f-1a2b3c4d5e6f";
const organiser = "00000000-0000-0000-0000-000000000001";
const coordinator = "00000000-0000-0000-0000-000000000002";
const nominee = "00000000-0000-0000-0000-000000000008";
const at = "2026-10-04T08:31:22.104Z";
const ref = { eventId, eventReference: "EVT-2026-0042", eventName: "Freshmen Orientation" };

function message(type: string, data: Record<string, unknown>): NotifiableEvent {
  return { id: "018f2a6b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", type, time: at, subject: eventId, data: { ...ref, ...data } };
}

const common = { notificationType: "", eventId, eventReference: "EVT-2026-0042", relatedReference: null };

describe("notificationsFor", () => {
  it("B1/E1: tells the coordinator assigned on submission that the request awaits their review", () => {
    const notes = notificationsFor(
      message("event.coordinator-assigned", { coordinatorId: coordinator, assignmentRule: "ROUND_ROBIN", assignedAt: at }),
    );
    expect(notes).toEqual([
      {
        ...common,
        notificationType: "event.coordinator-assigned",
        recipientUserId: coordinator,
        message: "Event request EVT-2026-0042 “Freshmen Orientation” has been assigned to you and is awaiting your review.",
      },
    ]);
  });

  it("B1: notifies nobody on submission itself, because the coordinator is named only by the assignment message", () => {
    expect(
      notificationsFor(
        message("event.submitted", { ownerId: organiser, proposedStartAt: at, proposedEndAt: at, submittedAt: at }),
      ),
    ).toEqual([]);
  });

  it("D2: tells the organiser that clarification is required", () => {
    const [note] = notificationsFor(
      message("event.clarification-requested", {
        clarificationId: eventId,
        ownerId: organiser,
        requestedBy: coordinator,
        requestedAt: at,
      }),
    );
    expect(note).toMatchObject({
      recipientUserId: organiser,
      message: "Clarification is required on your event request EVT-2026-0042 “Freshmen Orientation”.",
    });
  });

  it("D3: tells the coordinator who asked that the organiser has responded", () => {
    const [note] = notificationsFor(
      message("event.clarification-responded", {
        clarificationId: eventId,
        requestedBy: coordinator,
        respondedBy: organiser,
        respondedAt: at,
        amendedFields: [],
      }),
    );
    expect(note).toMatchObject({
      recipientUserId: coordinator,
      message: "The organiser has responded to your clarification request on EVT-2026-0042 “Freshmen Orientation”.",
    });
  });

  it("D4: tells the organiser of the approval", () => {
    const [note] = notificationsFor(
      message("event.approved", { ownerId: organiser, approvedBy: coordinator, approvedAt: at }),
    );
    expect(note).toMatchObject({
      recipientUserId: organiser,
      message: "Your event request EVT-2026-0042 “Freshmen Orientation” has been approved.",
    });
  });

  it("D5: tells the organiser of the rejection, including the reason", () => {
    const [note] = notificationsFor(
      message("event.rejected", { ownerId: organiser, rejectedBy: coordinator, rejectedAt: at, reason: "Clashes with exams" }),
    );
    expect(note).toMatchObject({
      recipientUserId: organiser,
      message: "Your event request EVT-2026-0042 “Freshmen Orientation” has been rejected. Reason: Clashes with exams",
    });
  });

  const proposal = { proposalId: eventId, outgoingCoordinatorId: coordinator, nomineeCoordinatorId: nominee };

  it("E2: tells the nominated coordinator they can accept or decline", () => {
    const notes = notificationsFor(message("event.reassignment-proposed", { ...proposal, proposedAt: at }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      recipientUserId: nominee,
      message:
        "You have been nominated to take over as coordinator of EVT-2026-0042 “Freshmen Orientation”. Accept or decline the proposal.",
    });
  });

  it("E2: tells both coordinators when the proposal is accepted", () => {
    const notes = notificationsFor(message("event.reassignment-accepted", { ...proposal, resolvedAt: at }));
    expect(notes.map((n) => [n.recipientUserId, n.message])).toEqual([
      [nominee, "You are now the coordinator of EVT-2026-0042 “Freshmen Orientation”."],
      [coordinator, "Your reassignment of EVT-2026-0042 “Freshmen Orientation” was accepted. You are no longer its coordinator."],
    ]);
  });

  it("E2: tells the proposing coordinator when the proposal is declined", () => {
    const notes = notificationsFor(message("event.reassignment-declined", { ...proposal, resolvedAt: at }));
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({
      recipientUserId: coordinator,
      message: "Your proposal to reassign EVT-2026-0042 “Freshmen Orientation” was declined. You remain its coordinator.",
    });
  });

  describe("O2: tells the assigned coordinator how Technical Support updated an equipment line", () => {
    const line = {
      lineId: "33333333-3333-4333-8333-333333333333",
      coordinatorId: coordinator,
      equipmentTypeName: "Folding Chairs",
      quantity: 40,
      previousStatus: "SUBMITTED",
      reason: null,
      substituteEquipmentTypeName: null,
      substituteQuantity: null,
      changedBy: "00000000-0000-0000-0000-000000000004",
      changedAt: at,
    };

    it("names the event, the line and the new status", () => {
      const notes = notificationsFor(message("equipment-request.line-status-changed", { ...line, newStatus: "CONFIRMED" }));
      expect(notes).toEqual([
        {
          ...common,
          notificationType: "equipment-request.line-status-changed",
          recipientUserId: coordinator,
          message: "Technical Support updated equipment for EVT-2026-0042 “Freshmen Orientation”: Folding Chairs × 40 is now Confirmed.",
        },
      ]);
    });

    it("adds the reason when the line is Unavailable", () => {
      const [note] = notificationsFor(
        message("equipment-request.line-status-changed", { ...line, newStatus: "UNAVAILABLE", reason: "All chairs are out that week" }),
      );
      expect(note!.message).toBe(
        "Technical Support updated equipment for EVT-2026-0042 “Freshmen Orientation”: Folding Chairs × 40 is now Unavailable. Reason: All chairs are out that week",
      );
    });

    it("adds the substitute when the line is Substituted", () => {
      const [note] = notificationsFor(
        message("equipment-request.line-status-changed", {
          ...line,
          newStatus: "SUBSTITUTED",
          substituteEquipmentTypeName: "Stacking Stools",
          substituteQuantity: 30,
        }),
      );
      expect(note!.message).toBe(
        "Technical Support updated equipment for EVT-2026-0042 “Freshmen Orientation”: Folding Chairs × 40 is now Substituted. Substitute: Stacking Stools × 30.",
      );
    });

    it("says how many were reserved when Q1 reserved fewer than requested", () => {
      const [note] = notificationsFor(
        message("equipment-request.line-status-changed", { ...line, quantity: 5, newStatus: "RESERVED", reservedQuantity: 3 }),
      );
      expect(note!.message).toBe(
        "Technical Support updated equipment for EVT-2026-0042 “Freshmen Orientation”: Folding Chairs × 5 is now Reserved (3 of 5 reserved).",
      );
    });

    it("says nothing extra when everything was reserved, or the message carries no reserved quantity", () => {
      for (const extra of [{ reservedQuantity: 40 }, { reservedQuantity: null }, {}]) {
        const [note] = notificationsFor(message("equipment-request.line-status-changed", { ...line, newStatus: "RESERVED", ...extra }));
        expect(note!.message).toBe(
          "Technical Support updated equipment for EVT-2026-0042 “Freshmen Orientation”: Folding Chairs × 40 is now Reserved.",
        );
      }
    });

    it("words a release as a release, with the reason, whatever the line became", () => {
      const [back] = notificationsFor(
        message("equipment-request.line-status-changed", { ...line, newStatus: "CONFIRMED", released: true, reason: "Event moved" }),
      );
      expect(back!.recipientUserId).toBe(coordinator);
      expect(back!.message).toBe(
        "The reservation of Folding Chairs × 40 for EVT-2026-0042 “Freshmen Orientation” was released. The line is now Confirmed. Reason: Event moved",
      );
      const [removed] = notificationsFor(
        message("equipment-request.line-status-changed", { ...line, newStatus: "REMOVED", released: true, reason: "Request line removed" }),
      );
      expect(removed!.message).toBe(
        "The reservation of Folding Chairs × 40 for EVT-2026-0042 “Freshmen Orientation” was released. The line is now Removed. Reason: Request line removed",
      );
    });

    it("notifies only the coordinator the message names", () => {
      const notes = notificationsFor(message("equipment-request.line-status-changed", { ...line, newStatus: "UNDER_REVIEW" }));
      expect(notes.map((note) => note.recipientUserId)).toEqual([coordinator]);
    });
  });

  it("notifies nobody for a message type it has no rule for", () => {
    expect(notificationsFor(message("event.something-new", {}))).toEqual([]);
  });

  it("records the event, its reference and the message type on every notification (T2 AC1)", () => {
    const [note] = notificationsFor(
      message("event.approved", { ownerId: organiser, approvedBy: coordinator, approvedAt: at }),
    );
    expect(note).toMatchObject({ notificationType: "event.approved", eventId, eventReference: "EVT-2026-0042" });
  });
});

describe("L1: tells the venue's Venue Staff about a new booking request", () => {
  const staff = ["00000000-0000-0000-0000-000000000003", "00000000-0000-0000-0000-000000000013"];
  const submitted = {
    bookingRequestId: "44444444-4444-4444-8444-444444444444",
    reference: "BKR-000001",
    venueId: "55555555-5555-4555-8555-555555555555",
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    staffIds: staff,
    requestedBy: coordinator,
    requestedAt: at,
  };

  it("notifies each of the venue's staff, naming the booking reference, the event and the period in Singapore time (L1-T7)", () => {
    const notes = notificationsFor(message("venue-booking.request-submitted", submitted));
    const text =
      "Booking request BKR-000001 was submitted for Lee Kong Chian Auditorium: EVT-2026-0042 “Freshmen Orientation”, " +
      "Wednesday 2 December 2026, 14:00–18:00. It is waiting in your Booking requests queue.";
    expect(notes).toEqual(
      staff.map((recipientUserId) => ({
        ...common,
        notificationType: "venue-booking.request-submitted",
        recipientUserId,
        relatedReference: "BKR-000001",
        message: text,
      })),
    );
  });

  it("gives both days when the period crosses midnight", () => {
    const [note] = notificationsFor(
      message("venue-booking.request-submitted", { ...submitted, startsAt: "2026-12-02T14:00:00.000Z", endsAt: "2026-12-03T02:00:00.000Z" }),
    );
    expect(note!.message).toContain("Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 10:00.");
  });
});
