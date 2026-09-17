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
import type { Role } from "./api/types.js";

const ROLE_LABELS: Record<Role, string> = {
  EVENT_ORGANISER: "Event Organiser",
  EVENT_COORDINATOR: "Event Coordinator",
  VENUE_STAFF: "Venue Staff",
  TECH_SUPPORT_STAFF: "Technical Support",
  ATTENDEE: "Attendee",
};

const EVERY_ROLE: Role[] = [
  "EVENT_ORGANISER",
  "EVENT_COORDINATOR",
  "VENUE_STAFF",
  "TECH_SUPPORT_STAFF",
  "ATTENDEE",
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
  return "/console";
}

function Shell() {
  const { session, signOut } = useSession();
  const location = useLocation();
  const navigate = useNavigate();

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
              {route.nav!.label}
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
