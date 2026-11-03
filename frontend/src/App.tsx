import type { ReactElement, ReactNode } from "react";
import { HashRouter, Link, matchPath, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Button from "@atlaskit/button/new";
import { SessionProvider, useSession } from "./auth/SessionContext.js";
import { FixedTheme, ThemeProvider } from "./theme/ThemeProvider.js";
import { AppShell } from "./shell/AppShell.js";
import { LoginFrame } from "./shell/LoginFrame.js";
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
import { ATTENDEE_ACCENT } from "./components/AttendeeParts.js";
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
import Spinner from "@atlaskit/spinner";
import SectionMessage from "@atlaskit/section-message";
import { permissionKey, type PermissionCheck } from "./api/permissions.js";
import { usePermissions } from "./auth/usePermissions.js";
import { EquipmentList } from "./screens/EquipmentList.js";
import { EquipmentEditor } from "./screens/EquipmentEditor.js";
import { EquipmentRequest } from "./screens/EquipmentRequest.js";
import { EquipmentRequests } from "./screens/EquipmentRequests.js";
import { UnassignedQueue } from "./screens/UnassignedQueue.js";
import { AssignmentDetail } from "./screens/AssignmentDetail.js";
import { AssignmentsOverview } from "./screens/AssignmentsOverview.js";
import { OpenEvents } from "./screens/OpenEvents.js";
import { OpenEventDetail } from "./screens/OpenEventDetail.js";
import { MyRegistrations } from "./screens/MyRegistrations.js";
import { RegistrationSettings } from "./screens/RegistrationSettings.js";
import { SafetyQueue } from "./screens/SafetyQueue.js";
import { SafetyReviewDetail } from "./screens/SafetyReviewDetail.js";

const ROLE_LABELS: Record<Role, string> = {
  EVENT_ORGANISER: "Event Organiser",
  EVENT_COORDINATOR: "Event Coordinator",
  VENUE_STAFF: "Venue Staff",
  TECH_SUPPORT_STAFF: "Technical Support",
  ATTENDEE: "Attendee",
  EVENT_COORDINATOR_LEAD: "Event Coordinator Lead",
  SAFETY_OFFICER: "Safety Officer",
};

/** Any signed-in role may open it: the API console and their own notifications. */
const SESSION = "SESSION" as const;

/**
 * A2, EN-07 — each screen names the policy resource and action behind it, never
 * a list of roles. The console asks the server's Cerbos policies once per session
 * (POST /api/v1/permissions/check) and both the navigation and the route guard
 * use the answer, so the menu and the server can't disagree. Neither is the real
 * control: the server refuses the wrong role regardless, which the API console
 * demonstrates.
 */
const ROUTES: {
  path: string;
  element: ReactElement;
  permission: PermissionCheck | typeof SESSION;
  nav?: { label: string; to: string };
}[] = [
  {
    path: "/requests",
    element: <MyRequests />,
    permission: { kind: "event", action: "create" },
    nav: { label: "My requests", to: "/requests" },
  },
  { path: "/requests/:id", element: <RequestDetail />, permission: { kind: "event", action: "create" } },
  // One route for a new and an existing draft, so saving a new one does not
  // remount the editor and lose what is on screen.
  {
    path: "/drafts/:id",
    element: <DraftEditor />,
    permission: { kind: "event", action: "view_draft" },
    nav: { label: "New request", to: "/drafts/new" },
  },
  {
    path: "/queue",
    element: <ReviewQueue />,
    permission: { kind: "event", action: "review" },
    nav: { label: "Review queue", to: "/queue" },
  },
  {
    path: "/events",
    element: <AllEvents />,
    permission: { kind: "event", action: "review" },
    nav: { label: "All events", to: "/events" },
  },
  { path: "/review/:id", element: <ReviewDetail />, permission: { kind: "event", action: "review" } },
  // O1: the coordinator records the equipment an event requires; the server allows only the assigned one to write.
  { path: "/events/:eventId/equipment", element: <EquipmentRequest />, permission: { kind: "equipment_request_line", action: "create" } },
  // G1: the owning organiser or the assigned coordinator edits descriptive details.
  { path: "/events/:id/details", element: <EventDetailsEditor />, permission: { kind: "event", action: "update_details" } },
  // L1, L2: an event's venue requests; its assigned coordinator requests and withdraws them.
  { path: "/events/:id/venue-requests", element: <EventVenueRequests />, permission: { kind: "booking_request", action: "list" } },
  { path: "/events/:id/venue-requests/new", element: <BookingRequestForm />, permission: { kind: "booking_request", action: "create" } },
  // L1, M1: the pending requests for the venues a Venue Staff member looks after.
  {
    path: "/booking-requests",
    element: <BookingRequestQueue />,
    permission: { kind: "booking_request", action: "view_queue" },
    nav: { label: "Booking requests", to: "/booking-requests" },
  },
  // L3: the assigned coordinator requests a hold; Venue Staff of the venue place it, with its expiry.
  { path: "/events/:id/holds/new", element: <HoldRequestForm />, permission: { kind: "booking_request", action: "request_hold" } },
  {
    path: "/holds",
    element: <HoldQueue />,
    permission: { kind: "booking_request", action: "view_queue" },
    nav: { label: "Hold requests", to: "/holds" },
  },
  // H1, H2: every internal role reads the catalogue; only Venue Staff maintain it.
  {
    path: "/venues",
    element: <VenueList />,
    permission: { kind: "venue", action: "view" },
    nav: { label: "Venues", to: "/venues" },
  },
  // J1, J2: Event Coordinators find a venue by name, building and an event's requirements.
  // "/venues/search" is a different path from "/venues/:id"; the router ranks the static one first.
  {
    path: "/venues/search",
    element: <VenueSearch />,
    permission: { kind: "venue", action: "search" },
    nav: { label: "Find a venue", to: "/venues/search" },
  },
  {
    path: "/venues/:id",
    element: <VenueDetail />,
    permission: { kind: "venue", action: "view" },
  },
  // I1: every internal role reads a venue's availability; attendees have no route to it.
  {
    path: "/venues/:id/availability",
    element: <VenueAvailability />,
    permission: { kind: "venue", action: "view_calendar" },
  },
  // K1: only Event Coordinators assess a venue against an event.
  { path: "/venues/:id/suitability", element: <VenueSuitability />, permission: { kind: "venue", action: "check_suitability" } },
  { path: "/venues/new", element: <VenueEditor />, permission: { kind: "venue", action: "create" } },
  { path: "/venues/:id/edit", element: <VenueEditor />, permission: { kind: "venue", action: "update" } },
  // I2: Venue Staff record and remove a venue's unavailability; the server limits it to the venue's own staff.
  { path: "/venues/:id/unavailability", element: <VenueUnavailability />, permission: { kind: "venue", action: "view_unavailability" } },
  {
    path: "/equipment",
    element: <EquipmentList />,
    permission: { kind: "equipment_type", action: "update" },
    nav: { label: "Equipment", to: "/equipment" },
  },
  { path: "/equipment/new", element: <EquipmentEditor />, permission: { kind: "equipment_type", action: "create" } },
  { path: "/equipment/:id/edit", element: <EquipmentEditor />, permission: { kind: "equipment_type", action: "update" } },
  {
    path: "/equipment/availability",
    element: <EquipmentAvailability />,
    permission: { kind: "equipment_type", action: "check_availability" },
    nav: { label: "Equipment availability", to: "/equipment/availability" },
  },
  // O2: Technical Support see every equipment line and update its status.
  {
    path: "/equipment/requests",
    element: <EquipmentRequests />,
    permission: { kind: "equipment_request_line", action: "update_status" },
    nav: { label: "Equipment requests", to: "/equipment/requests" },
  },
  // E3: the Lead assigns each submitted request from the unassigned queue; no other role reaches it.
  {
    path: "/assignments/unassigned",
    element: <UnassignedQueue />,
    permission: { kind: "event", action: "assign" },
    nav: { label: "Unassigned", to: "/assignments/unassigned" },
  },
  // E5: the Lead oversees every active event, each coordinator's load and each event's assignment history.
  {
    path: "/assignments",
    element: <AssignmentsOverview />,
    permission: { kind: "event", action: "view_assignments" },
    nav: { label: "Assignments", to: "/assignments" },
  },
  { path: "/assignments/:eventId", element: <AssignmentDetail />, permission: { kind: "event", action: "view_assignments" } },
  // R2, R4: the owning organiser sets the registration window and the withdrawal deadline; the server allows only the owner.
  { path: "/events/:id/registration", element: <RegistrationSettings />, permission: { kind: "event", action: "configure_registration" } },
  // R1 to R4: the attendee surface (implementation.md §7.2), served by the registration service.
  {
    path: "/open-events",
    element: <OpenEvents />,
    permission: { kind: "registration", action: "create" },
    nav: { label: "Events", to: "/open-events" },
  },
  { path: "/open-events/:eventId", element: <OpenEventDetail />, permission: { kind: "registration", action: "create" } },
  {
    path: "/my-registrations",
    element: <MyRegistrations />,
    permission: { kind: "registration", action: "withdraw" },
    nav: { label: "My registrations", to: "/my-registrations" },
  },
  // U1: the Safety Officer's queue and the review of one event, with its decision form.
  {
    path: "/safety",
    element: <SafetyQueue />,
    permission: { kind: "event", action: "view_safety_queue" },
    nav: { label: "Safety queue", to: "/safety" },
  },
  { path: "/safety/:eventId", element: <SafetyReviewDetail />, permission: { kind: "event", action: "view_safety_review" } },
  // T2: every role reads its own notifications.
  {
    path: "/notifications",
    element: <Notifications />,
    permission: SESSION,
    nav: { label: "Notifications", to: "/notifications" },
  },
  {
    path: "/console",
    element: <ApiConsole />,
    permission: SESSION,
    nav: { label: "API console", to: "/console" },
  },
];

/** Every distinct permission the screens need: one request per session asks about them all. */
const CHECKS: readonly PermissionCheck[] = [
  ...new Map(
    ROUTES.flatMap((route) => (route.permission === SESSION ? [] : [route.permission])).map((check) => [permissionKey(check), check])
  ).values(),
];

function landingFor(role: Role): string {
  if (role === "EVENT_ORGANISER") return "/requests";
  if (role === "EVENT_COORDINATOR") return "/queue";
  if (role === "TECH_SUPPORT_STAFF") return "/equipment";
  if (role === "EVENT_COORDINATOR_LEAD") return "/assignments/unassigned";
  if (role === "ATTENDEE") return "/open-events";
  if (role === "SAFETY_OFFICER") return "/safety";
  return "/console";
}

function Shell() {
  const { session, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();
  const permissions = usePermissions(session?.token ?? null, CHECKS);
  // Asked once the permissions are in, so the screen they open asks for its data first, as before.
  const unread = useUnreadCount(permissions.status === "loading" ? null : (session?.token ?? null), location.pathname);

  if (!session) {
    return (
      <LoginFrame>
        <Login />
      </LoginFrame>
    );
  }

  const may = (route: (typeof ROUTES)[number]) =>
    route.permission === SESSION || (permissions.status === "ready" && permissions.allowed.has(permissionKey(route.permission)));
  // The role's usual start page, or the console if the policies no longer give it that screen.
  const landingRoute = ROUTES.find((route) => route.path === landingFor(session.role));
  const landing = landingRoute && may(landingRoute) ? landingFor(session.role) : "/console";
  // Until the permissions arrive, where the role starts isn't known yet.
  const toLanding =
    permissions.status === "loading" ? <Spinner label="Checking your permissions" /> : <Navigate to={landing} replace />;

  function guarded(route: (typeof ROUTES)[number]): ReactElement {
    if (may(route)) return route.element;
    if (permissions.status === "loading") return <Spinner label="Checking your permissions" />;
    if (permissions.status === "failed") {
      return (
        <SectionMessage appearance="error" title="Your permissions could not be checked">
          <p>{permissions.message}</p>
        </SectionMessage>
      );
    }
    return <Navigate to={landing} replace />;
  }

  // A1 — signing out leaves nothing behind, including the address of the last
  // screen, so whoever signs in next starts from their own landing screen. The
  // login screen must not navigate as well: a second navigation races the
  // redirect below and leaves the next user on a blank page.
  async function onSignOut() {
    navigate("/", { replace: true });
    await signOut();
  }

  // On "/" or an unknown address the shell is about to send the role to its start page. Offering
  // the navigation first would let a click race that redirect and lose, so it waits for it.
  const redirecting = !ROUTES.some((route) => matchPath(route.path, location.pathname));
  const permitted = redirecting ? [] : ROUTES.filter((route) => route.nav && may(route));

  const routes = (
    <Routes>
      <Route path="/" element={toLanding} />
      {ROUTES.map((route) => (
        <Route key={route.path} path={route.path} element={guarded(route)} />
      ))}
      <Route path="*" element={toLanding} />
    </Routes>
  );

  if (session.role === "ATTENDEE") {
    // The API console stays reachable by its address, but is not one of the attendee's screens.
    const attendeeNav = permitted.filter((route) => route.path !== "/console");
    return (
      <FixedTheme mode="light" surface="attendee">
        <AttendeeShell email={session.email} unread={unread} nav={attendeeNav.map((r) => r.nav!)} onSignOut={() => void onSignOut()}>
          {routes}
        </AttendeeShell>
      </FixedTheme>
    );
  }

  return (
    <AppShell
      email={session.email}
      roleLabel={ROLE_LABELS[session.role]}
      nav={permitted.map((route) => route.nav!)}
      patterns={ROUTES.map((route) => route.path)}
      unread={unread}
      onSignOut={() => void onSignOut()}
    >
      {routes}
    </AppShell>
  );
}

/**
 * implementation.md §7.2, ADR-0014: attendees get their own surface, not the
 * staff console's chrome. One column at most 720px wide that fills a phone
 * (360px and up), a short navigation that wraps, the system font, and one
 * accent colour.
 */
function AttendeeShell(props: {
  email: string;
  unread: number | null;
  nav: { label: string; to: string }[];
  onSignOut: () => void;
  children: ReactNode;
}) {
  const location = useLocation();
  return (
    <div
      data-testid="attendee-shell"
      style={{
        fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
        background: "#F7F8F9",
        minHeight: "100vh",
        color: "#172B4D",
      }}
    >
      <header style={{ background: "#FFFFFF", borderBottom: "1px solid #DCDFE4" }}>
        <div
          style={{
            maxWidth: 720,
            width: "100%",
            boxSizing: "border-box",
            margin: "0 auto",
            padding: "8px 16px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 16,
          }}
        >
          <strong style={{ color: ATTENDEE_ACCENT }}>ConnectSphere</strong>
          <nav aria-label="Attendee" style={{ display: "flex", flexWrap: "wrap", gap: 16, flex: 1 }}>
            {props.nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                aria-current={location.pathname === item.to ? "page" : undefined}
                style={{ color: "#172B4D", fontWeight: location.pathname === item.to ? 700 : 400, padding: "8px 0" }}
              >
                {item.to === "/notifications" && props.unread ? `${item.label} (${props.unread})` : item.label}
              </Link>
            ))}
          </nav>
          <span style={{ fontSize: 14, color: "#44546F" }}>{props.email}</span>
          <Button appearance="subtle" onClick={props.onSignOut}>
            Sign out
          </Button>
        </div>
      </header>
      <main style={{ maxWidth: 720, width: "100%", boxSizing: "border-box", margin: "0 auto", padding: 16 }}>{props.children}</main>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider>
      <SessionProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </SessionProvider>
    </ThemeProvider>
  );
}
