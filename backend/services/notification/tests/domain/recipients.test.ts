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
