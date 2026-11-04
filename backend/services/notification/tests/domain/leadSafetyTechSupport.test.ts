import { describe, expect, it } from "vitest";
import { notificationsFor, type NotifiableEvent } from "../../src/domain/recipients.js";

/**
 * Team decision D-02 (clarifications.md, 4 Nov 2026): the Event Coordinator Lead, the Safety
 * Officer and Technical Support are told of the work that has just entered their queues (the
 * staging dry run's D3). As for every rule, the recipients are the users the message names: the
 * producer looks up the active holders of the role and names them (implementation.md §3.5).
 * Messages written before D-02 name none, and notify nobody new.
 */

const eventId = "6f1c2a4e-8b1d-4c3a-9e2f-1a2b3c4d5e6f";
const organiser = "00000000-0000-0000-0000-000000000001";
const coordinator = "00000000-0000-0000-0000-000000000002";
const venueStaff = "00000000-0000-0000-0000-000000000003";
const techSupport = "00000000-0000-0000-0000-000000000004";
const otherTechSupport = "00000000-0000-0000-0000-000000000014";
const lead = "00000000-0000-0000-0000-000000000009";
const otherLead = "00000000-0000-0000-0000-000000000019";
const safetyOfficer = "00000000-0000-0000-0000-000000000010";
const otherSafetyOfficer = "00000000-0000-0000-0000-000000000020";
const at = "2026-11-04T06:30:00.000Z";
const ref = { eventId, eventReference: "EVT-2026-0042", eventName: "Freshmen Orientation" };
const event = "EVT-2026-0042 “Freshmen Orientation”";

function message(type: string, data: Record<string, unknown>, subject = eventId): NotifiableEvent {
  return { id: "018f2a6b-3c4d-4e5f-8a9b-0c1d2e3f4a5b", type, time: at, subject, data: { ...ref, ...data } };
}

const recipientsOf = (notes: ReturnType<typeof notificationsFor>) => notes.map((note) => note.recipientUserId);

describe("E3 (D-02): a submitted request enters the unassigned queue", () => {
  const submitted = { ownerId: organiser, proposedStartAt: at, proposedEndAt: at, submittedAt: at };
  const text = `Event request ${event} was submitted and is waiting in your unassigned queue to be assigned a coordinator.`;

  it("tells every Lead the message names, once each, and nobody else", () => {
    const notes = notificationsFor(message("event.submitted", { ...submitted, leadIds: [lead, otherLead] }));
    expect(notes).toEqual([
      { recipientUserId: lead, notificationType: "event.submitted", eventId, eventReference: "EVT-2026-0042", relatedReference: null, message: text },
      { recipientUserId: otherLead, notificationType: "event.submitted", eventId, eventReference: "EVT-2026-0042", relatedReference: null, message: text },
    ]);
  });

  it("tells nobody when no Lead is active", () => {
    expect(notificationsFor(message("event.submitted", { ...submitted, leadIds: [] }))).toEqual([]);
  });

  it("tells nobody for a submission written before D-02, which names no Lead", () => {
    expect(notificationsFor(message("event.submitted", submitted))).toEqual([]);
  });

  it("never tells the organiser of their own submission", () => {
    expect(recipientsOf(notificationsFor(message("event.submitted", { ...submitted, leadIds: [lead] })))).not.toContain(organiser);
  });
});

describe("U1 (D-02): an event's arrangements are confirmed and it enters Safety Review", () => {
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
        staffIds: [venueStaff],
      },
    ],
    reservations: [
      { reservationId: "55555555-5555-4555-8555-555555555555", equipmentTypeName: "Folding Chairs", reservedQuantity: 40, reservedBy: techSupport },
    ],
  };
  const text = `${event} has its venue and equipment arrangements confirmed and is waiting in your Safety Review queue.`;

  it("tells every Safety Officer the message names, after the recipients F5 names", () => {
    const notes = notificationsFor(message("event.arrangements-confirmed", { ...confirmed, safetyOfficerIds: [safetyOfficer, otherSafetyOfficer] }));
    expect(recipientsOf(notes)).toEqual([organiser, venueStaff, techSupport, safetyOfficer, otherSafetyOfficer]);
    expect(notes.filter((note) => note.recipientUserId === safetyOfficer).map((note) => note.message)).toEqual([text]);
    expect(notes.filter((note) => note.recipientUserId === otherSafetyOfficer).map((note) => note.message)).toEqual([text]);
    expect(notes.every((note) => note.notificationType === "event.arrangements-confirmed" && note.relatedReference === null)).toBe(true);
  });

  it("tells only F5's recipients when no Safety Officer is active", () => {
    expect(recipientsOf(notificationsFor(message("event.arrangements-confirmed", { ...confirmed, safetyOfficerIds: [] })))).toEqual([
      organiser,
      venueStaff,
      techSupport,
    ]);
  });

  it("tells only F5's recipients for a confirmation written before D-02, which names no Safety Officer", () => {
    expect(recipientsOf(notificationsFor(message("event.arrangements-confirmed", confirmed)))).toEqual([organiser, venueStaff, techSupport]);
  });
});

describe("O1 (D-02): a coordinator saves a new equipment request line", () => {
  const lineId = "33333333-3333-4333-8333-333333333333";
  const line = {
    lineId,
    equipmentTypeName: "Folding Chairs",
    quantity: 40,
    requiredFrom: "2026-12-02T06:00:00.000Z",
    requiredTo: "2026-12-02T10:00:00.000Z",
    requestedBy: coordinator,
    requestedAt: at,
    technicalSupportIds: [techSupport, otherTechSupport],
  };
  const text = `New equipment request for ${event}: Folding Chairs × 40, needed Wednesday 2 December 2026, 14:00–18:00. It is waiting in your Equipment requests list.`;

  it("tells every Technical Support member the message names, once each, and nobody else", () => {
    const notes = notificationsFor(message("equipment-request.line-submitted", line, lineId));
    expect(notes).toEqual([
      { recipientUserId: techSupport, notificationType: "equipment-request.line-submitted", eventId, eventReference: "EVT-2026-0042", relatedReference: null, message: text },
      { recipientUserId: otherTechSupport, notificationType: "equipment-request.line-submitted", eventId, eventReference: "EVT-2026-0042", relatedReference: null, message: text },
    ]);
    expect(recipientsOf(notes)).not.toContain(coordinator);
  });

  it("gives both ends of a period that crosses midnight, in Singapore time", () => {
    const [note] = notificationsFor(
      message("equipment-request.line-submitted", { ...line, requiredFrom: "2026-12-02T14:00:00.000Z", requiredTo: "2026-12-02T17:00:00.000Z" }, lineId),
    );
    expect(note!.message).toBe(
      `New equipment request for ${event}: Folding Chairs × 40, needed Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 01:00. It is waiting in your Equipment requests list.`,
    );
  });

  it("tells nobody when no Technical Support member is active", () => {
    expect(notificationsFor(message("equipment-request.line-submitted", { ...line, technicalSupportIds: [] }, lineId))).toEqual([]);
  });
});
