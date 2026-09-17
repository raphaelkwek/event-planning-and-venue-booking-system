export type Role =
  | "EVENT_ORGANISER"
  | "EVENT_COORDINATOR"
  | "VENUE_STAFF"
  | "TECH_SUPPORT_STAFF"
  | "ATTENDEE";

export type EventStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "UNDER_REVIEW"
  | "AWAITING_CLARIFICATION"
  | "APPROVED"
  | "PLANNING"
  | "CONFIRMED"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

/** Mirrors `venueRequirementsSchema` in packages/contracts. */
export interface VenueRequirements {
  layout?: string | null;
  facilities?: string[] | null;
  notes?: string | null;
}

/** Mirrors `equipmentRequirementLineSchema` in packages/contracts. */
export interface EquipmentRequirementLine {
  equipmentType: string;
  quantity: number;
  notes?: string | null;
}

export interface EventRecord {
  id: string;
  reference: string | null;
  ownerId: string;
  name: string;
  purpose: string | null;
  description: string | null;
  proposedStartAt: string | null;
  proposedEndAt: string | null;
  expectedAttendance: number | null;
  venueRequirements: VenueRequirements | null;
  accessibilityNeeds: string | null;
  equipmentRequired: boolean | null;
  equipmentRequirements: EquipmentRequirementLine[] | null;
  registrationRequired: boolean | null;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  status: EventStatus;
  submittedAt: string | null;
  lastSavedAt: string;
  reviewingCoordinatorId: string | null;
  reviewStartedAt: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  assignedCoordinatorId: string | null;
}

export interface EventListItem {
  id: string;
  kind: "DRAFT" | "EVENT";
  status: EventStatus;
  name: string;
  reference: string | null;
  lastSavedAt: string | null;
  submittedAt: string | null;
  assignedCoordinatorId: string | null;
  decidedAt: string | null;
}

export interface Clarification {
  id: string;
  eventId: string;
  message: string;
  requestedBy: string;
  requestedAt: string;
  status: "OPEN" | "RESPONDED";
  responseMessage: string | null;
  respondedBy: string | null;
  respondedAt: string | null;
}

export interface Paged<T> {
  items: T[];
  nextCursor: string | null;
}

/** The request body both submission paths share. */
export interface RequestFields {
  name: string;
  purpose: string;
  description: string;
  proposedStartAt: string;
  proposedEndAt: string;
  expectedAttendance: string;
  accessibilityNeeds: string;
  equipmentRequired: boolean;
  registrationRequired: boolean;
  registrationOpensAt: string;
  registrationClosesAt: string;
  venueLayout: string;
  /** Comma-separated, as typed. */
  venueFacilities: string;
  venueNotes: string;
  equipmentLines: { equipmentType: string; quantity: string; notes: string }[];
}
