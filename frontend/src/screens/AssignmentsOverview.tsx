import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Lozenge from "@atlaskit/lozenge";
import { useSignedIn } from "../auth/SessionContext.js";
import { listAssignments, type Coordinator, type OverviewEvent } from "../api/assignments.js";
import { STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { useUserNames } from "../shared/useUserNames.js";
import { Refusal } from "../components/Refusal.js";

const cell = { padding: "6px 8px", borderBottom: "1px solid #DFE1E6", textAlign: "left" as const, verticalAlign: "top" as const };
const coordinatorName = (c: Coordinator) => c.displayName ?? c.email;

/**
 * E5 — the Lead's view of every active event (not Completed, Cancelled or
 * Rejected) with its coordinator, each coordinator's load, and a filter by
 * coordinator, which the server applies.
 */
export function AssignmentsOverview() {
  const session = useSignedIn();
  const [events, setEvents] = useState<OverviewEvent[] | null>(null);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    setError(null);
    listAssignments(session.token, filter || undefined)
      .then((page) => {
        setEvents(page.items);
        setCoordinators(page.coordinators);
      })
      .catch(setError);
  }, [session.token, filter]);

  // Named through identity, so a coordinator who has since left is still named.
  const nameOf = useUserNames(session.token, (events ?? []).map((event) => event.assignedCoordinatorId));

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Assignments</h2>
      <Refusal error={error} />

      <h3>Coordinators</h3>
      <ul aria-label="Coordinators' active events">
        {coordinators.map((c) => (
          <li key={c.id}>{`${coordinatorName(c)}: ${c.activeAssignments} active`}</li>
        ))}
      </ul>

      <label htmlFor="overview-coordinator" style={{ display: "block", margin: "16px 0 4px" }}>
        Coordinator
      </label>
      <select id="overview-coordinator" value={filter} onChange={(e) => setFilter(e.target.value)}>
        <option value="">All coordinators</option>
        {coordinators.map((c) => (
          <option key={c.id} value={c.id}>
            {coordinatorName(c)}
          </option>
        ))}
      </select>

      {events !== null && events.length === 0 && <p>No active events.</p>}
      {events !== null && events.length > 0 && (
        <table aria-label="Active events" style={{ borderCollapse: "collapse", width: "100%", marginTop: 16 }}>
          <thead>
            <tr>
              {["Reference", "Name", "Status", "Coordinator"].map((heading) => (
                <th key={heading} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id}>
                <td style={cell}>
                  <Link to={`/assignments/${event.id}`}>{event.reference ?? event.id}</Link>
                </td>
                <td style={cell}>{event.name}</td>
                <td style={cell}>
                  <Lozenge appearance={STATUS_APPEARANCE[event.status]}>{STATUS_LABELS[event.status]}</Lozenge>
                </td>
                <td style={cell}>{event.assignedCoordinatorId ? nameOf(event.assignedCoordinatorId) : "Unassigned"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
