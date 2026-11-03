/**
 * The seeded accounts (backend/services/planning-core/migrations/identity/seed), as the
 * browser tests and the fake Supabase Auth server both know them. `authId` is the
 * Supabase Auth user id that identity.users.supabase_user_id points at, and `id` is
 * ConnectSphere's own user id.
 */
export const SEED_PASSWORD = "ConnectSphere-Test-1234!";

export interface SeededAccount {
  key: AccountKey;
  email: string;
  authId: string;
  id: string;
  displayName: string;
  roleLabel: string;
  /** The role code identity returns and the web app keeps in its session (implementation.md §6). */
  role: string;
}

export type AccountKey =
  | "organiser"
  | "organiser2"
  | "coordinator"
  | "coordinator2"
  | "venuestaff"
  | "techsupport"
  | "attendee"
  | "deactivated"
  | "lead"
  | "safety";

const n = (i: number) => String(i).padStart(12, "0");

function account(key: AccountKey, index: number, displayName: string, roleLabel: string, role: string): SeededAccount {
  return {
    role,
    key,
    email: `${key}@connectsphere.test`,
    authId: `10000000-0000-0000-0000-${n(index)}`,
    id: `00000000-0000-0000-0000-${n(index)}`,
    displayName,
    roleLabel,
  };
}

export const ACCOUNTS: Record<AccountKey, SeededAccount> = {
  organiser: account("organiser", 1, "Organiser One", "Event Organiser", "EVENT_ORGANISER"),
  coordinator: account("coordinator", 2, "Coordinator One", "Event Coordinator", "EVENT_COORDINATOR"),
  venuestaff: account("venuestaff", 3, "Venue Staff One", "Venue Staff", "VENUE_STAFF"),
  techsupport: account("techsupport", 4, "Tech Support One", "Technical Support", "TECH_SUPPORT_STAFF"),
  attendee: account("attendee", 5, "Attendee One", "Attendee", "ATTENDEE"),
  deactivated: account("deactivated", 6, "Deactivated Organiser", "Event Organiser", "EVENT_ORGANISER"),
  organiser2: account("organiser2", 7, "Organiser Two", "Event Organiser", "EVENT_ORGANISER"),
  coordinator2: account("coordinator2", 8, "Coordinator Two", "Event Coordinator", "EVENT_COORDINATOR"),
  lead: account("lead", 9, "Lead One", "Event Coordinator Lead", "EVENT_COORDINATOR_LEAD"),
  safety: account("safety", 10, "Safety Officer One", "Safety Officer", "SAFETY_OFFICER"),
};
