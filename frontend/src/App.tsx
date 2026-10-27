import type { ReactElement } from "react";
import { HashRouter, Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Button from "@atlaskit/button/new";
import { SessionProvider, useSession } from "./auth/SessionContext.js";
import { Login } from "./screens/Login.js";
import { MyRequests } from "./screens/MyRequests.js";
import { DraftEditor } from "./screens/DraftEditor.js";
import { RequestDetail } from "./screens/RequestDetail.js";
import { ReviewQueue } from "./screens/ReviewQueue.js";
import { AllEvents } from "./screens/AllEvents.js";
import { ReviewDetail } from "./screens/ReviewDetail.js";
import { ApiConsole } from "./screens/ApiConsole.js";
import { VenueList } from "./screens/VenueList.js";
import { VenueEditor } from "./screens/VenueEditor.js";
import { Notifications } from "./screens/Notifications.js";
import { useUnreadCount } from "./shared/useUnreadCount.js";
import { VenueDetail } from "./screens/VenueDetail.js";
import { VenueUnavailability } from "./screens/VenueUnavailability.js";
import { EventDetailsEditor } from "./screens/EventDetailsEditor.js";
import { EventVenueRequests } from "./screens/EventVenueRequests.js";
import { BookingRequestForm } from "./screens/BookingRequestForm.js";
import { BookingRequestQueue } from "./screens/BookingRequestQueue.js";
import { HoldQueue } from "./screens/HoldQueue.js";
import { HoldRequestForm } from "./screens/HoldRequestForm.js";
import { EquipmentAvailability } from "./screens/EquipmentAvailability.js";
import { VenueAvailability } from "./screens/VenueAvailability.js";
import { VenueSearch } from "./screens/VenueSearch.js";
import { VenueSuitability } from "./screens/VenueSuitability.js";
import type { Role } from "./api/types.js";
import { EquipmentList } from "./screens/EquipmentList.js";
import { EquipmentEditor } from "./screens/EquipmentEditor.js";
import { EquipmentRequest } from "./screens/EquipmentRequest.js";
import { EquipmentRequests } from "./screens/EquipmentRequests.js";
import { UnassignedQueue } from "./screens/UnassignedQueue.js";
import { AssignmentDetail } from "./screens/AssignmentDetail.js";

const ROLE_LABELS: Record<Role, string> = {
  EVENT_ORGANISER: "Event Organiser",
  EVENT_COORDINATOR: "Event Coordinator",
  VENUE_STAFF: "Venue Staff",
  TECH_SUPPORT_STAFF: "Technical Support",
  ATTENDEE: "Attendee",
  EVENT_COORDINATOR_LEAD: "Event Coordinator Lead",
};

const EVERY_ROLE: Role[] = [
  "EVENT_ORGANISER",
  "EVENT_COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT_STAFF",
  "ATTENDEE",
  "EVENT_COORDINATOR_LEAD",
];

/**
 * A2 — one permitted-role list governs both what the navigation offers and
 * which screens a role may open. Neither is the real control: the server
 * refuses the wrong role regardless, which the API console demonstrates.
 */
const ROUTES: {
  path: string;
  element: ReactElement;
  roles: Role[];
  nav?: { label: string; to: string };
}[] = [
  {
    path: "/requests",
    element: <MyRequests />,
    roles: ["EVENT_ORGANISER"],
    nav: { label: "My requests", to: "/requests" },
  },
  { path: "/requests/:id", element: <RequestDetail />, roles: ["EVENT_ORGANISER"] },
  // One route for a new and an existing draft, so saving a new one does not
  // remount the editor and lose what is on screen.
  {
    path: "/drafts/:id",
    element: <DraftEditor />,
    roles: ["EVENT_ORGANISER"],
    nav: { label: "New request", to: "/drafts/new" },
  },
  {
    path: "/queue",
    element: <ReviewQueue />,
    roles: ["EVENT_COORDINATOR"],
    nav: { label: "Review queue", to: "/queue" },
  },
  {
    path: "/events",
    element: <AllEvents />,
    roles: ["EVENT_COORDINATOR"],
    nav: { label: "All events", to: "/events" },
  },
  { path: "/review/:id", element: <ReviewDetail />, roles: ["EVENT_COORDINATOR"] },
  // O1: the coordinator records the equipment an event requires; the server allows only the assigned one to write.
  { path: "/events/:eventId/equipment", element: <EquipmentRequest />, roles: ["EVENT_COORDINATOR"] },
  // G1: the owning organiser or the assigned coordinator edits descriptive details.
  { path: "/events/:id/details", element: <EventDetailsEditor />, roles: ["EVENT_ORGANISER", "EVENT_COORDINATOR"] },
  // L1, L2: an event's venue requests; its assigned coordinator requests and withdraws them.
  { path: "/events/:id/venue-requests", element: <EventVenueRequests />, roles: ["EVENT_ORGANISER", "EVENT_COORDINATOR"] },
  { path: "/events/:id/venue-requests/new", element: <BookingRequestForm />, roles: ["EVENT_COORDINATOR"] },
  // L1, M1: the pending requests for the venues a Venue Staff member looks after.
  {
    path: "/booking-requests",
    element: <BookingRequestQueue />,
    roles: ["VENUE_STAFF"],
    nav: { label: "Booking requests", to: "/booking-requests" },
  },
  // L3: the assigned coordinator requests a hold; Venue Staff of the venue place it, with its expiry.
  { path: "/events/:id/holds/new", element: <HoldRequestForm />, roles: ["EVENT_COORDINATOR"] },
  {
    path: "/holds",
    element: <HoldQueue />,
    roles: ["VENUE_STAFF"],
    nav: { label: "Hold requests", to: "/holds" },
  },
  // H1, H2: every internal role reads the catalogue; only Venue Staff maintain it.
  {
    path: "/venues",
    element: <VenueList />,
    roles: ["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT_STAFF"],
    nav: { label: "Venues", to: "/venues" },
  },
  // J1, J2: Event Coordinators find a venue by name, building and an event's requirements.
  // "/venues/search" is a different path from "/venues/:id"; the router ranks the static one first.
  {
    path: "/venues/search",
    element: <VenueSearch />,
    roles: ["EVENT_COORDINATOR"],
    nav: { label: "Find a venue", to: "/venues/search" },
  },
  {
    path: "/venues/:id",
    element: <VenueDetail />,
    roles: ["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT_STAFF"],
  },
  // I1: every internal role reads a venue's availability; attendees have no route to it.
  {
    path: "/venues/:id/availability",
    element: <VenueAvailability />,
    roles: ["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT_STAFF"],
  },
  // K1: only Event Coordinators assess a venue against an event.
  { path: "/venues/:id/suitability", element: <VenueSuitability />, roles: ["EVENT_COORDINATOR"] },
  { path: "/venues/new", element: <VenueEditor />, roles: ["VENUE_STAFF"] },
  { path: "/venues/:id/edit", element: <VenueEditor />, roles: ["VENUE_STAFF"] },
  // I2: Venue Staff record and remove a venue's unavailability; the server limits it to the venue's own staff.
  { path: "/venues/:id/unavailability", element: <VenueUnavailability />, roles: ["VENUE_STAFF"] },
  {
    path: "/equipment",
    element: <EquipmentList />,
    roles: ["TECH_SUPPORT_STAFF"],
    nav: { label: "Equipment", to: "/equipment" },
  },
  { path: "/equipment/new", element: <EquipmentEditor />, roles: ["TECH_SUPPORT_STAFF"] },
  { path: "/equipment/:id/edit", element: <EquipmentEditor />, roles: ["TECH_SUPPORT_STAFF"] },
  {
    path: "/equipment/availability",
    element: <EquipmentAvailability />,
    roles: ["TECH_SUPPORT_STAFF"],
    nav: { label: "Equipment availability", to: "/equipment/availability" },
  },
  // O2: Technical Support see every equipment line and update its status.
  {
    path: "/equipment/requests",
    element: <EquipmentRequests />,
    roles: ["TECH_SUPPORT_STAFF"],
    nav: { label: "Equipment requests", to: "/equipment/requests" },
  },
  // E3: the Lead assigns each submitted request from the unassigned queue; no other role reaches it.
  {
    path: "/assignments/unassigned",
    element: <UnassignedQueue />,
    roles: ["EVENT_COORDINATOR_LEAD"],
    nav: { label: "Unassigned", to: "/assignments/unassigned" },
  },
  { path: "/assignments/:eventId", element: <AssignmentDetail />, roles: ["EVENT_COORDINATOR_LEAD"] },
  // T2: every role reads its own notifications.
  {
    path: "/notifications",
    element: <Notifications />,
    roles: EVERY_ROLE,
    nav: { label: "Notifications", to: "/notifications" },
  },
  {
    path: "/console",
    element: <ApiConsole />,
    roles: EVERY_ROLE,
    nav: { label: "API console", to: "/console" },
  },
];

function landingFor(role: Role): string {
  if (role === "EVENT_ORGANISER") return "/requests";
  if (role === "EVENT_COORDINATOR") return "/queue";
  if (role === "TECH_SUPPORT_STAFF") return "/equipment";
  if (role === "EVENT_COORDINATOR_LEAD") return "/assignments/unassigned";
  return "/console";
}

function Shell() {
  const { session, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const unread = useUnreadCount(session?.token ?? null, location.pathname);

  if (!session) return <Login />;

  // A1 — signing out leaves nothing behind, including the address of the last
  // screen, so whoever signs in next starts from their own landing screen. The
  // login screen must not navigate as well: a second navigation races the
  // redirect below and leaves the next user on a blank page.
  async function onSignOut() {
    navigate("/", { replace: true });
    await signOut();
  }

  const permitted = ROUTES.filter((route) => route.nav && route.roles.includes(session.role));

  return (
    <div>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          gap: 24,
          padding: "12px 24px",
          borderBottom: "1px solid #DFE1E6",
          background: "#fff",
        }}
      >
        <strong>ConnectSphere</strong>

        <nav style={{ display: "flex", gap: 16, flex: 1 }}>
          {permitted.map((route) => (
            <Link
              key={route.path}
              to={route.nav!.to}
              style={{
                textDecoration: location.pathname === route.nav!.to ? "underline" : "none",
                color: "#172B4D",
              }}
            >
              {route.path === "/notifications" && unread ? `${route.nav!.label} (${unread})` : route.nav!.label}
            </Link>
          ))}
        </nav>

        <span style={{ fontSize: 13, color: "#626F86" }}>
          {session.email} · <strong>{ROLE_LABELS[session.role]}</strong>
        </span>
        <Button appearance="subtle" onClick={() => void onSignOut()}>
          Sign out
        </Button>
      </header>

      <main style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<Navigate to={landingFor(session.role)} replace />} />
          {ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={
                route.roles.includes(session.role) ? (
                  route.element
                ) : (
                  <Navigate to={landingFor(session.role)} replace />
                )
              }
            />
          ))}
          <Route path="*" element={<Navigate to={landingFor(session.role)} replace />} />
        </Routes>
      </main>
    </div>
  );
}

export function App() {
  return (
    <SessionProvider>
      <HashRouter>
        <Shell />
      </HashRouter>
    </SessionProvider>
  );
}
