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

  it("S1: tells the assigned coordinator which fields the organiser asked to change", () => {
    const notes = notificationsFor(
      message("change-request.submitted", {
        coordinatorId: coordinator,
        changeRequestId: "0b5f7a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
        fields: ["proposedStartAt", "expectedAttendance"],
        requestedBy: organiser,
        requestedAt: at,
      }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ recipientUserId: coordinator, notificationType: "change-request.submitted" });
    expect(notes[0]!.message).toBe("A change has been requested for EVT-2026-0042 “Freshmen Orientation”: start, expected attendance.");
  });

  it("S1: names a field it has no label for by its own name", () => {
    const [note] = notificationsFor(
      message("change-request.submitted", {
        coordinatorId: coordinator,
        changeRequestId: "0b5f7a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
        fields: ["expectedAttendance", "somethingNew"],
        requestedBy: organiser,
        requestedAt: at,
      }),
    );
    expect(note!.message).toBe("A change has been requested for EVT-2026-0042 “Freshmen Orientation”: expected attendance, somethingNew.");
  });

  it("S2: tells the organiser which fields of their change request were approved", () => {
    const notes = notificationsFor(
      message("change-request.approved", {
        ownerId: organiser,
        changeRequestId: "0b5f7a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
        fields: ["proposedStartAt", "expectedAttendance"],
        decidedBy: coordinator,
        decidedAt: at,
      }),
    );
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ recipientUserId: organiser, notificationType: "change-request.approved" });
    expect(notes[0]!.message).toBe("Your change request for EVT-2026-0042 “Freshmen Orientation” was approved: start, expected attendance.");
  });

  it("S2: tells the organiser their change request was rejected, with the reason", () => {
    const [note] = notificationsFor(
      message("change-request.rejected", {
        ownerId: organiser,
        changeRequestId: "0b5f7a3e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
        fields: ["proposedStartAt"],
        decidedBy: coordinator,
        decidedAt: at,
        reason: "The hall is booked.",
      }),
    );
    expect(note).toMatchObject({ recipientUserId: organiser, notificationType: "change-request.rejected" });
    expect(note!.message).toBe("Your change request for EVT-2026-0042 “Freshmen Orientation” was rejected. Reason: The hall is booked.");
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

describe("M1, M2: tell the requesting coordinator and the event's owner what Venue Staff decided", () => {
  const decided = {
    bookingRequestId: "44444444-4444-4444-8444-444444444444",
    reference: "BKR-000001",
    venueId: "55555555-5555-4555-8555-555555555555",
    venueName: "Lee Kong Chian Auditorium",
    startsAt: "2026-12-02T06:00:00.000Z",
    endsAt: "2026-12-02T10:00:00.000Z",
    coordinatorId: coordinator,
    ownerId: organiser,
    decidedBy: "00000000-0000-0000-0000-000000000003",
    decidedAt: at,
  };
  const approved = { ...decided, bookingId: "66666666-6666-4666-8666-666666666666", replacedBookingId: null };
  const rejected = { ...decided, reason: "Already promised to another faculty", suggestion: "Seminar Room 2-1" };
  const each = (type: string, text: string) =>
    [coordinator, organiser].map((recipientUserId) => ({
      ...common,
      notificationType: type,
      recipientUserId,
      relatedReference: "BKR-000001",
      message: text,
    }));

  it("tells both that the request was approved and the booking confirmed, naming the venue, event and period (M1-T8)", () => {
    expect(notificationsFor(message("venue-booking.request-approved", approved))).toEqual(
      each(
        "venue-booking.request-approved",
        "Booking request BKR-000001 was approved, and the booking is confirmed: Lee Kong Chian Auditorium for " +
          "EVT-2026-0042 “Freshmen Orientation”, Wednesday 2 December 2026, 14:00–18:00.",
      ),
    );
  });

  it("tells both that the request was rejected, with the reason and the suggested alternative (M2-T5)", () => {
    expect(notificationsFor(message("venue-booking.request-rejected", rejected))).toEqual(
      each(
        "venue-booking.request-rejected",
        "Booking request BKR-000001 for Lee Kong Chian Auditorium was rejected: EVT-2026-0042 “Freshmen Orientation”, " +
          "Wednesday 2 December 2026, 14:00–18:00. Reason: Already promised to another faculty. Suggested alternative: Seminar Room 2-1",
      ),
    );
  });

  it("gives the reason alone when nothing was suggested, without doubling its full stop", () => {
    const [note] = notificationsFor(message("venue-booking.request-rejected", { ...rejected, reason: "Closed for exams.", suggestion: null }));
    expect(note!.message).toMatch(/Reason: Closed for exams\.$/);
    const [inner] = notificationsFor(message("venue-booking.request-rejected", { ...rejected, reason: "Closed. Exams", suggestion: null }));
    expect(inner!.message).toMatch(/Reason: Closed\. Exams\.$/);
  });

  it("tells a coordinator who also owns the event once", () => {
    const notes = notificationsFor(message("venue-booking.request-approved", { ...approved, ownerId: coordinator }));
    expect(notes.map((n) => n.recipientUserId)).toEqual([coordinator]);
  });
});

describe("I2: tell the coordinator when a block disrupts, or stops disrupting, their booking or request", () => {
  const disrupted = {
    blockId: "77777777-7777-4777-8777-777777777777",
    venueId: "55555555-5555-4555-8555-555555555555",
    venueName: "Lee Kong Chian Auditorium",
    kind: "BOOKING",
    reference: "BKR-000001",
    coordinatorId: coordinator,
    blockStartsAt: "2026-12-02T08:00:00.000Z",
    blockEndsAt: "2026-12-02T11:00:00.000Z",
    reasonType: "MAINTENANCE",
    description: "Stage rigging inspection",
    actedBy: "00000000-0000-0000-0000-000000000003",
    actedAt: at,
  };
  const one = (type: string, text: string) => [
    { ...common, notificationType: type, recipientUserId: coordinator, relatedReference: "BKR-000001", message: text },
  ];

  it("names the venue, booking, event, period and reason, and says alternative arrangements are required (I2-T8, CR-02)", () => {
    expect(notificationsFor(message("venue-booking.booking-disrupted", disrupted))).toEqual(
      one(
        "venue-booking.booking-disrupted",
        "Lee Kong Chian Auditorium is unavailable on Wednesday 2 December 2026, 16:00–19:00 (Maintenance: Stage rigging inspection), " +
          "which disrupts booking BKR-000001 for EVT-2026-0042 “Freshmen Orientation”. The booking requires reconfirmation, " +
          "and alternative arrangements are required.",
      ),
    );
  });

  it("names a pending request as a booking request, and a hold as a hold (I2-T9)", () => {
    const [request] = notificationsFor(message("venue-booking.booking-disrupted", { ...disrupted, kind: "REQUEST" }));
    expect(request!.message).toContain("which disrupts booking request BKR-000001 for EVT-2026-0042 “Freshmen Orientation”. The request requires reconfirmation");
    const [hold] = notificationsFor(message("venue-booking.booking-disrupted", { ...disrupted, kind: "HOLD", reason: undefined }));
    expect(hold!.message).toContain("which disrupts hold BKR-000001");
    expect(hold!.message).toContain("The hold requires reconfirmation");
  });

  it("says when the removal clears the flag, and when another block still disrupts it (I2-T11)", () => {
    const removed =
      "The unavailability of Lee Kong Chian Auditorium on Wednesday 2 December 2026, 16:00–19:00 (Maintenance: Stage rigging inspection) was removed.";
    expect(notificationsFor(message("venue-booking.disruption-cleared", { ...disrupted, stillDisrupted: false }))).toEqual(
      one("venue-booking.disruption-cleared", `${removed} Booking BKR-000001 for EVT-2026-0042 “Freshmen Orientation” no longer requires reconfirmation.`),
    );
    const [still] = notificationsFor(message("venue-booking.disruption-cleared", { ...disrupted, stillDisrupted: true }));
    expect(still!.message).toBe(
      `${removed} Booking BKR-000001 for EVT-2026-0042 “Freshmen Orientation” still requires reconfirmation: other unavailability still overlaps it.`,
    );
  });

  it("says a block with no end lasts until Venue Staff lift it, and that its removal ended it (I5-T8)", () => {
    const openEnded = { ...disrupted, blockStartsAt: "2026-12-02T05:00:00.000Z", blockEndsAt: null };
    expect(notificationsFor(message("venue-booking.booking-disrupted", openEnded))).toEqual(
      one(
        "venue-booking.booking-disrupted",
        "Lee Kong Chian Auditorium is unavailable from Wednesday 2 December 2026, 13:00 until Venue Staff lift it " +
          "(Maintenance: Stage rigging inspection), which disrupts booking BKR-000001 for EVT-2026-0042 “Freshmen Orientation”. " +
          "The booking requires reconfirmation, and alternative arrangements are required.",
      ),
    );
    expect(notificationsFor(message("venue-booking.disruption-cleared", { ...openEnded, stillDisrupted: false }))).toEqual(
      one(
        "venue-booking.disruption-cleared",
        "The open-ended unavailability of Lee Kong Chian Auditorium from Wednesday 2 December 2026, 13:00 " +
          "(Maintenance: Stage rigging inspection) was removed. Booking BKR-000001 for EVT-2026-0042 “Freshmen Orientation” no longer requires reconfirmation.",
      ),
    );
  });

  it("says the venue's setup and turnaround time keep the flag, when no other block does (H3-T14)", () => {
    const still = (stillCause: string) =>
      notificationsFor(message("venue-booking.disruption-cleared", { ...disrupted, stillDisrupted: true, stillCause }))[0]!.message;
    expect(still("BUFFER_CONFLICT")).toMatch(
      /was removed\. Booking BKR-000001 for EVT-2026-0042 “Freshmen Orientation” still requires reconfirmation: with the venue's setup and turnaround time it still overlaps another booking, hold or request\.$/,
    );
    expect(still("UNAVAILABILITY")).toContain("still requires reconfirmation: other unavailability still overlaps it.");
  });
});

describe("L6: tells the holding coordinator a hold is about to expire, and that it has", () => {
  const hold = {
    holdId: "99999999-9999-4999-8999-999999999999",
    holdReference: "HLD-000007",
    venueId: "55555555-5555-4555-8555-555555555555",
    venueName: "Lee Kong Chian Auditorium",
    coordinatorId: coordinator,
    startsAt: "2026-12-02T02:00:00.000Z",
    endsAt: "2026-12-02T04:00:00.000Z",
    expiresAt: "2026-12-01T06:00:00.000Z",
  };
  const where = "Hold HLD-000007 on Lee Kong Chian Auditorium for EVT-2026-0042 “Freshmen Orientation”, Wednesday 2 December 2026, 10:00–12:00,";
  const one = (type: string, text: string) => [
    { ...common, notificationType: type, recipientUserId: coordinator, relatedReference: "HLD-000007", message: text },
  ];

  it("reminds the coordinator, naming the venue, event, period and expiry in Singapore time (L6-T6)", () => {
    expect(notificationsFor(message("venue-booking.hold-expiring", hold))).toEqual(
      one(
        "venue-booking.hold-expiring",
        `${where} expires on Tuesday 1 December 2026, 14:00. Convert it to a booking request or ask Venue Staff to extend it.`,
      ),
    );
  });

  it("tells the coordinator it expired, and the period is free (L6-T7)", () => {
    expect(notificationsFor(message("venue-booking.hold-expired", hold))).toEqual(
      one("venue-booking.hold-expired", `${where} expired on Tuesday 1 December 2026, 14:00. The period is free for others.`),
    );
  });

  it("notifies nobody when a hold is placed or its expiry changed", () => {
    expect(notificationsFor(message("venue-booking.hold-placed", { ...hold, reminderLeadMinutes: 60 }))).toEqual([]);
    expect(notificationsFor(message("venue-booking.hold-expiry-changed", { ...hold, changedBy: coordinator }))).toEqual([]);
  });
});

describe("H3: tell the coordinator when the venue's new setup or turnaround time makes their booking overlap others", () => {
  const flagged = {
    venueId: "55555555-5555-4555-8555-555555555555",
    venueName: "Lee Kong Chian Auditorium",
    kind: "BOOKING",
    reference: "BKR-000001",
    coordinatorId: coordinator,
    overlapsReferences: ["BKR-000002"],
    setupMinutes: 0,
    turnaroundMinutes: 30,
    actedBy: "00000000-0000-0000-0000-000000000003",
    actedAt: at,
  };

  it("names the venue's new times, the booking, the event and what it overlaps, and says nothing was moved (H3-T10)", () => {
    expect(notificationsFor(message("venue-booking.buffer-conflict-flagged", flagged))).toEqual([
      {
        ...common,
        notificationType: "venue-booking.buffer-conflict-flagged",
        recipientUserId: coordinator,
        relatedReference: "BKR-000001",
        message:
          "Lee Kong Chian Auditorium now needs 0 minutes of setup and 30 minutes of turnaround, so booking BKR-000001 for " +
          "EVT-2026-0042 “Freshmen Orientation” now overlaps BKR-000002. The booking requires reconfirmation. " +
          "It has not been removed, released or moved.",
      },
    ]);
  });

  it("names a hold as a hold, and lists every reference it overlaps", () => {
    const [hold] = notificationsFor(
      message("venue-booking.buffer-conflict-flagged", { ...flagged, kind: "HOLD", overlapsReferences: ["BKR-000002", "BKR-000003"] }),
    );
    expect(hold!.message).toContain("so hold BKR-000001 for EVT-2026-0042 “Freshmen Orientation” now overlaps BKR-000002 and BKR-000003. The hold requires");
  });

  it("names a pending request as a booking request, told to its requesting coordinator (H3-T11)", () => {
    const [request] = notificationsFor(message("venue-booking.buffer-conflict-flagged", { ...flagged, kind: "REQUEST" }));
    expect(request).toMatchObject({ recipientUserId: coordinator, relatedReference: "BKR-000001" });
    expect(request!.message).toBe(
      "Lee Kong Chian Auditorium now needs 0 minutes of setup and 30 minutes of turnaround, so booking request BKR-000001 for " +
        "EVT-2026-0042 “Freshmen Orientation” now overlaps BKR-000002. The request requires reconfirmation. " +
        "It has not been removed, released or moved.",
    );
  });
});

describe("F5: tells the owner, each booked venue's staff and each reserver that the arrangements are confirmed", () => {
  const venueStaff = "00000000-0000-0000-0000-000000000003";
  const otherVenueStaff = "00000000-0000-0000-0000-000000000013";
  const techSupport = "00000000-0000-0000-0000-000000000004";
  const otherTechSupport = "00000000-0000-0000-0000-000000000014";
  const confirmed = {
    ownerId: organiser,
    confirmedBy: coordinator,
    confirmedAt: at,
    bookings: [
      {
        bookingId: "44444444-4444-4444-8444-444444444444",
        reference: "BKR-000001",
        venueName: "Lee Kong Chian Auditorium",
        startsAt: "2026-12-02T06:00:00.000Z",
        endsAt: "2026-12-02T10:00:00.000Z",
        staffIds: [venueStaff, otherVenueStaff],
      },
      {
        bookingId: "66666666-6666-4666-8666-666666666666",
        reference: "BKR-000002",
        venueName: "Seminar Room 2-1",
        startsAt: "2026-12-02T06:00:00.000Z",
        endsAt: "2026-12-02T10:00:00.000Z",
        staffIds: [],
      },
    ],
    reservations: [
      { reservationId: "55555555-5555-4555-8555-555555555555", equipmentTypeName: "Folding Chairs", reservedQuantity: 40, reservedBy: techSupport },
      { reservationId: "77777777-7777-4777-8777-777777777777", equipmentTypeName: "Projectors", reservedQuantity: 2, reservedBy: techSupport },
      { reservationId: "88888888-8888-4888-8888-888888888888", equipmentTypeName: "Microphones", reservedQuantity: 4, reservedBy: otherTechSupport },
    ],
  };
  const notes = () => notificationsFor(message("event.arrangements-confirmed", confirmed));
  const textFor = (recipient: string) => notes().filter((note) => note.recipientUserId === recipient).map((note) => note.message);

  it("notifies exactly the owner, each venue's staff and each reserver, once each", () => {
    expect(notes().map((note) => note.recipientUserId)).toEqual([organiser, venueStaff, otherVenueStaff, techSupport, otherTechSupport]);
    expect(notes().every((note) => note.notificationType === "event.arrangements-confirmed" && note.eventId === eventId)).toBe(true);
  });

  it("tells the owner the event is in Safety Review, not Confirmed", () => {
    expect(textFor(organiser)).toEqual([
      "Your event EVT-2026-0042 “Freshmen Orientation” has its venue and equipment arrangements confirmed. It is now in Safety Review, awaiting the Safety Officer.",
    ]);
  });

  it("tells each Venue Staff member which booking at their venue, and when", () => {
    const text =
      "EVT-2026-0042 “Freshmen Orientation” has confirmed its arrangements, including booking BKR-000001 at Lee Kong Chian Auditorium, " +
      "Wednesday 2 December 2026, 14:00–18:00. It is now in Safety Review.";
    expect(textFor(venueStaff)).toEqual([text]);
    expect(textFor(otherVenueStaff)).toEqual([text]);
  });

  it("tells each reserver the equipment they reserved, and only theirs", () => {
    expect(textFor(techSupport)).toEqual([
      "EVT-2026-0042 “Freshmen Orientation” has confirmed its arrangements, including the equipment you reserved: Folding Chairs × 40, Projectors × 2. It is now in Safety Review.",
    ]);
    expect(textFor(otherTechSupport)).toEqual([
      "EVT-2026-0042 “Freshmen Orientation” has confirmed its arrangements, including the equipment you reserved: Microphones × 4. It is now in Safety Review.",
    ]);
  });

  it("notifies only the owner and the venue's staff when no equipment was reserved", () => {
    const recipients = notificationsFor(message("event.arrangements-confirmed", { ...confirmed, reservations: [] })).map(
      (note) => note.recipientUserId,
    );
    expect(recipients).toEqual([organiser, venueStaff, otherVenueStaff]);
  });
});

describe("event.cancelled (F3 AC6)", () => {
  const venueStaff = "00000000-0000-0000-0000-000000000005";
  const otherVenueStaff = "00000000-0000-0000-0000-000000000006";
  const techSupport = "00000000-0000-0000-0000-000000000007";
  const cancelled = {
    ownerId: organiser,
    assignedCoordinatorId: coordinator,
    reason: "The speaker withdrew.",
    cancelledBy: organiser,
    cancelledAt: at,
    bookings: [
      {
        reference: "BKR-000001",
        venueName: "Lee Kong Chian Auditorium",
        startsAt: "2026-12-02T06:00:00.000Z",
        endsAt: "2026-12-02T10:00:00.000Z",
        staffIds: [venueStaff, otherVenueStaff],
      },
      {
        reference: "BKR-000002",
        venueName: "Seminar Room 2-1",
        startsAt: "2026-12-02T06:00:00.000Z",
        endsAt: "2026-12-02T10:00:00.000Z",
        staffIds: [venueStaff],
      },
    ],
    reservations: [
      { equipmentTypeName: "Folding Chairs", reservedQuantity: 40, reservedBy: techSupport },
      { equipmentTypeName: "Projectors", reservedQuantity: 2, reservedBy: techSupport },
    ],
  };
  const notes = (data: Record<string, unknown> = cancelled) => notificationsFor(message("event.cancelled", data));
  const textFor = (recipient: string) => notes().filter((note) => note.recipientUserId === recipient).map((note) => note.message);
  const name = "EVT-2026-0042 “Freshmen Orientation” has been cancelled. Reason: The speaker withdrew.";

  it("notifies the owner, the coordinator, each venue's staff and each reserver, once each", () => {
    expect(notes().map((note) => note.recipientUserId)).toEqual([organiser, coordinator, venueStaff, otherVenueStaff, techSupport]);
    expect(notes().every((note) => note.notificationType === "event.cancelled" && note.eventId === eventId)).toBe(true);
  });

  it("gives the owner and the coordinator the reason", () => {
    expect(textFor(organiser)).toEqual([`Your event ${name}`]);
    expect(textFor(coordinator)).toEqual([`The event ${name}`]);
  });

  it("tells each Venue Staff member every booking of theirs that was released, in one notice (F4)", () => {
    expect(textFor(venueStaff)).toEqual([
      `${name} Released: booking BKR-000001 at Lee Kong Chian Auditorium, Wednesday 2 December 2026, 14:00–18:00; ` +
        "booking BKR-000002 at Seminar Room 2-1, Wednesday 2 December 2026, 14:00–18:00.",
    ]);
    expect(textFor(otherVenueStaff)).toEqual([
      `${name} Released: booking BKR-000001 at Lee Kong Chian Auditorium, Wednesday 2 December 2026, 14:00–18:00.`,
    ]);
  });

  it("tells each reserver the equipment they reserved was released (F4)", () => {
    expect(textFor(techSupport)).toEqual([`${name} The equipment you reserved has been released: Folding Chairs × 40, Projectors × 2.`]);
  });

  it("notifies only the owner when there is no coordinator and nothing booked or reserved", () => {
    const recipients = notes({ ...cancelled, assignedCoordinatorId: null, bookings: [], reservations: [] }).map((note) => note.recipientUserId);
    expect(recipients).toEqual([organiser]);
  });

  it("tells someone with two roles on the event once, as their first role", () => {
    const recipients = notes({ ...cancelled, assignedCoordinatorId: organiser, bookings: [], reservations: [] }).map(
      (note) => note.recipientUserId,
    );
    expect(recipients).toEqual([organiser]);
  });
});
