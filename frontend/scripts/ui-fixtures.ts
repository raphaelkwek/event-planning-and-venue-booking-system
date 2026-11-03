/**
 * Made-up data for capture-ui.ts: enough for the main screens to render as they would with real
 * records. Nothing here reaches a server; capture-ui.ts answers the app's API calls with it.
 */

/** An instant in December 2026, given in Singapore time. */
const at = (day: number, hour: number, minute = 0) => new Date(Date.UTC(2026, 11, day, hour - 8, minute)).toISOString();

export const USERS: Record<string, { displayName: string; email: string }> = {
  "u-org-1": { displayName: "Dr Mei Lin Tan", email: "organiser@connectsphere.test" },
  "u-org-2": { displayName: "Prof Arjun Rao", email: "organiser2@connectsphere.test" },
  "u-coord-1": { displayName: "Coordinator One", email: "coordinator@connectsphere.test" },
  "u-coord-2": { displayName: "Coordinator Two", email: "coordinator2@connectsphere.test" },
  "u-lead": { displayName: "Coordinator Lead", email: "lead@connectsphere.test" },
  "u-venue": { displayName: "Venue Staff", email: "venuestaff@connectsphere.test" },
  "u-tech": { displayName: "Technical Support", email: "techsupport@connectsphere.test" },
  "u-safety": { displayName: "Safety Officer", email: "safety@connectsphere.test" },
};

export const ACCOUNTS = {
  organiser: { userId: "u-org-1", email: "organiser@connectsphere.test", role: "EVENT_ORGANISER" },
  coordinator: { userId: "u-coord-1", email: "coordinator@connectsphere.test", role: "EVENT_COORDINATOR" },
  venue: { userId: "u-venue", email: "venuestaff@connectsphere.test", role: "VENUE_STAFF" },
  tech: { userId: "u-tech", email: "techsupport@connectsphere.test", role: "TECH_SUPPORT_STAFF" },
  lead: { userId: "u-lead", email: "lead@connectsphere.test", role: "EVENT_COORDINATOR_LEAD" },
  safety: { userId: "u-safety", email: "safety@connectsphere.test", role: "SAFETY_OFFICER" },
} as const;

export type AccountKey = keyof typeof ACCOUNTS;

const base = {
  purpose: "Share faculty research with industry partners",
  description: "A day of talks and posters from the School of Computing and Information Systems.",
  venueRequirements: { layout: "Theatre", facilities: ["Projector", "Microphone"], notes: null },
  accessibilityNeeds: "Step-free access to the stage, and a hearing loop",
  equipmentRequired: true,
  equipmentRequirements: [{ equipmentType: "Wireless microphone", quantity: 4, notes: null }],
  registrationRequired: true,
  registrationOpensAt: at(12, 9),
  registrationClosesAt: at(30, 18),
  reviewingCoordinatorId: null,
  reviewStartedAt: null,
  decidedBy: null,
  decidedAt: null,
  rejectionReason: null,
  cancellationReason: null,
  cancelledBy: null,
  cancelledAt: null,
  contactDetails: "Dr Mei Lin Tan, meilin.tan@smu.edu.sg, 6828 0123",
  version: 3,
};

const EVENT_ROWS = [
  { id: "e-1", reference: "EVT-000124", name: "Annual Research Symposium", status: "UNDER_REVIEW", ownerId: "u-org-1", start: [2, 9], end: [2, 17], attendance: 150, submitted: [6, 10, 12], coord: "u-coord-1" },
  { id: "e-2", reference: "EVT-000125", name: "Industry Night: Data and AI", status: "SUBMITTED", ownerId: "u-org-2", start: [4, 18], end: [4, 21], attendance: 220, submitted: [7, 14, 3], coord: "u-coord-2" },
  { id: "e-3", reference: "EVT-000126", name: "Freshmen Orientation Briefing", status: "AWAITING_CLARIFICATION", ownerId: "u-org-1", start: [9, 8], end: [9, 12], attendance: 480, submitted: [3, 9, 40], coord: "u-coord-1" },
  { id: "e-4", reference: "EVT-000119", name: "Sustainability Hackathon", status: "PLANNING", ownerId: "u-org-2", start: [14, 9], end: [15, 18], attendance: 96, submitted: [1, 11, 5], coord: "u-coord-1" },
  { id: "e-5", reference: "EVT-000117", name: "Alumni Career Fair", status: "SAFETY_REVIEW", ownerId: "u-org-1", start: [20, 10], end: [20, 16], attendance: 600, submitted: [1, 8, 30], coord: "u-coord-2" },
  { id: "e-6", reference: "EVT-000112", name: "Law and Technology Forum", status: "CONFIRMED", ownerId: "u-org-2", start: [24, 14], end: [24, 18], attendance: 120, submitted: [2, 16, 45], coord: "u-coord-1" },
  { id: "e-7", reference: "EVT-000108", name: "Wellness Week Opening", status: "REJECTED", ownerId: "u-org-1", start: [11, 12], end: [11, 14], attendance: 60, submitted: [2, 10, 0], coord: "u-coord-2" },
  { id: "e-8", reference: "EVT-000103", name: "Debate Society Finals", status: "CANCELLED", ownerId: "u-org-2", start: [16, 19], end: [16, 22], attendance: 200, submitted: [1, 15, 20], coord: "u-coord-1" },
] as const;

export const EVENTS = EVENT_ROWS.map((row) => ({
  ...base,
  id: row.id,
  reference: row.reference,
  name: row.name,
  status: row.status,
  ownerId: row.ownerId,
  proposedStartAt: at(row.start[0], row.start[1]),
  proposedEndAt: at(row.end[0], row.end[1]),
  expectedAttendance: row.attendance,
  submittedAt: at(row.submitted[0], row.submitted[1], row.submitted[2]),
  lastSavedAt: at(row.submitted[0], row.submitted[1], row.submitted[2]),
  assignedCoordinatorId: row.coord,
  reviewingCoordinatorId: row.status === "UNDER_REVIEW" ? row.coord : null,
  reviewStartedAt: row.status === "UNDER_REVIEW" ? at(6, 11) : null,
  decidedBy: ["PLANNING", "SAFETY_REVIEW", "CONFIRMED", "REJECTED"].includes(row.status) ? row.coord : null,
  decidedAt: ["PLANNING", "SAFETY_REVIEW", "CONFIRMED", "REJECTED"].includes(row.status) ? at(3, 15) : null,
  rejectionReason: row.status === "REJECTED" ? "The date clashes with the university's closure period." : null,
}));

export const LIST_ITEMS = EVENTS.map((event) => ({
  id: event.id,
  kind: "EVENT",
  status: event.status,
  name: event.name,
  reference: event.reference,
  lastSavedAt: event.lastSavedAt,
  submittedAt: event.submittedAt,
  assignedCoordinatorId: event.assignedCoordinatorId,
  decidedAt: event.decidedAt,
}));

export const DRAFT_ITEM = {
  id: "d-1",
  kind: "DRAFT",
  status: "DRAFT",
  name: "Graduate Poster Showcase",
  reference: null,
  lastSavedAt: at(3, 16, 20),
  submittedAt: null,
  assignedCoordinatorId: null,
  decidedAt: null,
};

export const STATUS_HISTORY = {
  eventId: "e-1",
  status: "UNDER_REVIEW",
  items: [
    { id: "h-1", previousStatus: "DRAFT", newStatus: "SUBMITTED", actorUserId: "u-org-1", actorRole: "EVENT_ORGANISER", triggeringAction: "submit", occurredAt: at(6, 10, 12) },
    { id: "h-2", previousStatus: "SUBMITTED", newStatus: "UNDER_REVIEW", actorUserId: "u-coord-1", actorRole: "EVENT_COORDINATOR", triggeringAction: "open for review", occurredAt: at(6, 11) },
  ],
};

export const CLARIFICATIONS = [
  {
    id: "c-1",
    eventId: "e-1",
    message: "Please confirm the expected attendance, including the poster presenters.",
    requestedBy: "u-coord-1",
    requestedAt: at(6, 11, 20),
    status: "RESPONDED",
    responseMessage: "150 guests plus 24 presenters.",
    respondedBy: "u-org-1",
    respondedAt: at(6, 15, 2),
  },
];

export const VENUES = [
  { id: "v-1", name: "Mochtar Riady Auditorium", building: "Administration Building, Level B1", maxCapacity: 500, isActive: true },
  { id: "v-2", name: "Seminar Room 2-1", building: "School of Computing and Information Systems 1", maxCapacity: 60, isActive: true },
  { id: "v-3", name: "Hall of Fame", building: "Lee Kong Chian School of Business", maxCapacity: 180, isActive: true },
  { id: "v-4", name: "Basement Studio", building: "School of Social Sciences", maxCapacity: 40, isActive: false },
];

const day = (date: string) => ({ date, committed: [] as unknown[], free: [] as unknown[] });

export function availability(from: string, to: string) {
  const days = [];
  const start = new Date(`${from}T00:00:00+08:00`);
  const end = new Date(`${to}T00:00:00+08:00`);
  for (let cursor = new Date(start); cursor <= end; cursor = new Date(cursor.getTime() + 86_400_000)) {
    const iso = new Date(cursor.getTime() + 8 * 3_600_000).toISOString().slice(0, 10);
    const entry = day(iso);
    const dayStart = (hour: number, minute = 0) => new Date(`${iso}T${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00+08:00`).toISOString();
    entry.committed.push({ kind: "OUTSIDE_HOURS", startsAt: dayStart(0), endsAt: dayStart(8) });
    const weekday = cursor.getUTCDay();
    if (weekday % 2 === 1) {
      entry.committed.push({ kind: "SETUP", startsAt: dayStart(8, 30), endsAt: dayStart(9) });
      entry.committed.push({ kind: "BOOKING", bookingStatus: "CONFIRMED", eventReference: "EVT-000112", startsAt: dayStart(9), endsAt: dayStart(12) });
      entry.committed.push({ kind: "TURNAROUND", startsAt: dayStart(12), endsAt: dayStart(12, 30) });
      entry.free.push({ startsAt: dayStart(12, 30), endsAt: dayStart(14) });
      entry.committed.push({ kind: "BOOKING", bookingStatus: "PENDING", eventReference: "EVT-000124", startsAt: dayStart(14), endsAt: dayStart(17) });
    } else {
      entry.free.push({ startsAt: dayStart(8), endsAt: dayStart(13) });
      entry.committed.push({ kind: "BOOKING", bookingStatus: "HELD", eventReference: "EVT-000119", startsAt: dayStart(13), endsAt: dayStart(18) });
    }
    entry.committed.push({ kind: "OUTSIDE_HOURS", startsAt: dayStart(22), endsAt: dayStart(23, 59) });
    days.push(entry);
  }
  return { venueId: "v-1", timeZone: "Asia/Singapore", from, to, days };
}

export const VENUE = {
  ...VENUES[0],
  layouts: [
    { name: "Theatre", capacity: 500 },
    { name: "Banquet", capacity: 280 },
  ],
  facilities: ["Projector", "Microphone", "Recording booth"],
  accessibilityFeatures: ["Step-free access", "Hearing loop"],
  operatingHours: {
    monday: { opensAt: "08:00", closesAt: "22:00" },
    tuesday: { opensAt: "08:00", closesAt: "22:00" },
    wednesday: { opensAt: "08:00", closesAt: "22:00" },
    thursday: { opensAt: "08:00", closesAt: "22:00" },
    friday: { opensAt: "08:00", closesAt: "22:00" },
    saturday: { opensAt: "09:00", closesAt: "18:00" },
    sunday: null,
  },
  setupMinutes: 30,
  turnaroundMinutes: 30,
  createdAt: at(1, 9),
  createdBy: "u-venue",
  updatedAt: at(2, 9),
  updatedBy: "u-venue",
};

const line = (id: string, event: (typeof EVENTS)[number], name: string, quantity: number, status: string) => ({
  id,
  eventId: event.id,
  eventReference: event.reference,
  equipmentTypeId: `t-${name}`,
  equipmentTypeName: name,
  quantity,
  notes: "",
  requiredFrom: event.proposedStartAt,
  requiredTo: event.proposedEndAt,
  status,
  requestedBy: event.assignedCoordinatorId,
  requestedAt: at(6, 12),
  statusChangedBy: status === "SUBMITTED" ? null : "u-tech",
  statusChangedAt: status === "SUBMITTED" ? null : at(7, 10),
  unavailableReason: status === "UNAVAILABLE" ? "All units are out for repair." : null,
  substituteEquipmentTypeId: null,
  substituteEquipmentTypeName: null,
  substituteQuantity: null,
  reservation: null,
  updatedAt: at(7, 10),
});

export const REQUEST_LINES = [
  line("l-1", EVENTS[0], "Wireless microphone", 4, "SUBMITTED"),
  line("l-2", EVENTS[0], "Projector", 2, "UNDER_REVIEW"),
  line("l-3", EVENTS[3], "Folding chairs", 120, "CONFIRMED"),
  line("l-4", EVENTS[4], "Portable PA system", 2, "UNAVAILABLE"),
  line("l-5", EVENTS[5], "Lectern", 1, "CONFIRMED"),
];

export const EQUIPMENT_TYPES = [
  { id: "t-1", name: "Wireless microphone", description: "Handheld, with receiver", kind: "SERIALIZED", totalQuantity: 12 },
  { id: "t-2", name: "Projector", description: "4K laser, 6000 lumens", kind: "SERIALIZED", totalQuantity: 6 },
  { id: "t-3", name: "Folding chairs", description: "Stackable", kind: "BULK", totalQuantity: 400 },
  { id: "t-4", name: "Portable PA system", description: "Two speakers and a mixer", kind: "SERIALIZED", totalQuantity: 3 },
];

export const COORDINATORS = [
  { id: "u-coord-1", displayName: "Coordinator One", email: "coordinator@connectsphere.test", activeAssignments: 4 },
  { id: "u-coord-2", displayName: "Coordinator Two", email: "coordinator2@connectsphere.test", activeAssignments: 3 },
];

export const NOTIFICATIONS = [
  { id: "n-1", notificationType: "CLARIFICATION_REQUESTED", eventId: "e-1", eventReference: "EVT-000124", relatedReference: null, message: "Coordinator One asked for a clarification on Annual Research Symposium.", occurredAt: at(6, 11, 20), createdAt: at(6, 11, 20), readAt: null },
  { id: "n-2", notificationType: "EVENT_APPROVED", eventId: "e-4", eventReference: "EVT-000119", relatedReference: null, message: "Sustainability Hackathon was approved and is now in Planning.", occurredAt: at(3, 15), createdAt: at(3, 15), readAt: null },
  { id: "n-3", notificationType: "BOOKING_CONFIRMED", eventId: "e-6", eventReference: "EVT-000112", relatedReference: "BKR-000031", message: "The booking of Mochtar Riady Auditorium for Law and Technology Forum is confirmed.", occurredAt: at(2, 9, 5), createdAt: at(2, 9, 5), readAt: at(2, 10) },
];

export const SAFETY_QUEUE = [
  { id: "e-5", reference: "EVT-000117", name: "Alumni Career Fair", expectedAttendance: 600, proposedStartAt: at(20, 10), proposedEndAt: at(20, 16), assignedCoordinatorId: "u-coord-2", enteredSafetyReviewAt: at(4, 9), decision: null },
];

export const BOOKING_QUEUE = [
  {
    id: "b-1",
    reference: "BKR-000041",
    eventId: "e-1",
    eventReference: "EVT-000124",
    venueId: "v-1",
    venueName: "Mochtar Riady Auditorium",
    startsAt: at(2, 9),
    endsAt: at(2, 17),
    layout: "Theatre",
    expectedAttendance: 150,
    facilities: ["Projector", "Microphone"],
    accessibilityFeatures: ["Step-free access"],
    eventStartsAt: at(2, 9),
    eventEndsAt: at(2, 17),
    eventAttendance: 150,
    differsFromEvent: false,
    differences: [],
    replacesBookingId: null,
    status: "PENDING",
    requestedBy: "u-coord-1",
    requestedAt: at(7, 9, 30),
    withdrawnBy: null,
    withdrawnAt: null,
    decidedBy: null,
    decidedAt: null,
    rejectionReason: null,
    conflicts: [],
  },
];
