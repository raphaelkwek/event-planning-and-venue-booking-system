import { HashRouter, Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import Button from "@atlaskit/button/new";
import { SessionProvider, useSession } from "./auth/SessionContext.js";
import { Login } from "./screens/Login.js";
import { MyRequests } from "./screens/MyRequests.js";
import { DraftEditor } from "./screens/DraftEditor.js";
import { RequestDetail } from "./screens/RequestDetail.js";
import { ReviewQueue } from "./screens/ReviewQueue.js";
import { ReviewDetail } from "./screens/ReviewDetail.js";
import { ApiConsole } from "./screens/ApiConsole.js";
import type { Role } from "./api/types.js";

/**
 * A2 — the same permitted-role list governs what the navigation offers and
 * what the server accepts. Hiding a link is a convenience, never the control:
 * every one of these paths is refused server-side for the wrong role too,
 * which the API console demonstrates.
 */
const NAV: { to: string; label: string; roles: Role[] }[] = [
  { to: "/requests", label: "My requests", roles: ["EVENT_ORGANISER"] },
  { to: "/drafts/new", label: "New request", roles: ["EVENT_ORGANISER"] },
  { to: "/queue", label: "Review queue", roles: ["EVENT_COORDINATOR"] },
  {
    to: "/console",
    label: "API console",
    roles: ["EVENT_ORGANISER", "EVENT_COORDINATOR", "VENUE_STAFF", "TECH_SUPPORT_STAFF", "ATTENDEE"],
  },
];

function Shell() {
  const { session, signOut } = useSession();
  const location = useLocation();

  if (!session) return <Login />;

  const permitted = NAV.filter((entry) => entry.roles.includes(session.role));

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
          {permitted.map((entry) => (
            <Link
              key={entry.to}
              to={entry.to}
              style={{
                textDecoration: location.pathname.startsWith(entry.to) ? "underline" : "none",
                color: "#172B4D",
              }}
            >
              {entry.label}
            </Link>
          ))}
        </nav>

        <span style={{ fontSize: 13, color: "#626F86" }}>
          {session.email} · <strong>{session.role}</strong>
        </span>
        <Button appearance="subtle" onClick={() => void signOut()}>
          Sign out
        </Button>
      </header>

      <main style={{ padding: 24 }}>
        <Routes>
          <Route path="/" element={<Navigate to={landingFor(session.role)} replace />} />
          <Route path="/requests" element={<MyRequests />} />
          <Route path="/requests/:id" element={<RequestDetail />} />
          <Route path="/drafts/:id" element={<DraftEditor />} />
          <Route path="/queue" element={<ReviewQueue />} />
          <Route path="/review/:id" element={<ReviewDetail />} />
          <Route path="/console" element={<ApiConsole />} />
          <Route path="*" element={<Navigate to={landingFor(session.role)} replace />} />
        </Routes>
      </main>
    </div>
  );
}

function landingFor(role: Role): string {
  if (role === "EVENT_ORGANISER") return "/requests";
  if (role === "EVENT_COORDINATOR") return "/queue";
  // A3 — the other roles have no events scope at all, so there is nothing for
  // them here. The console is left available to show what the server returns.
  return "/console";
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
