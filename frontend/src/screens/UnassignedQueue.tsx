import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSignedIn } from "../auth/SessionContext.js";
import { listUnassigned, type UnassignedRequest } from "../api/assignments.js";
import { formatMoment, formatPeriod } from "../shared/singaporeTime.js";
import { Refusal } from "../components/Refusal.js";

const cell = { padding: "6px 8px", borderBottom: "1px solid #DFE1E6", textAlign: "left" as const, verticalAlign: "top" as const };

/**
 * E3 — the Event Coordinator Lead's queue of submitted requests no coordinator
 * has yet, oldest submission first, as the server orders them.
 */
export function UnassignedQueue() {
  const session = useSignedIn();
  const [items, setItems] = useState<UnassignedRequest[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    listUnassigned(session.token)
      .then((page) => setItems(page.items))
      .catch(setError);
  }, [session.token]);

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Unassigned requests</h2>
      <p>Each request waits here until you assign it a coordinator. The oldest submission is first.</p>
      <Refusal error={error} />
      {items !== null && items.length === 0 && <p>No requests are waiting to be assigned.</p>}
      {items !== null && items.length > 0 && (
        <table aria-label="Unassigned requests" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Reference", "Name", "Proposed", "Attendance", "Submitted"].map((heading) => (
                <th key={heading} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={cell}>
                  <Link to={`/assignments/${item.id}`}>{item.reference ?? item.id}</Link>
                </td>
                <td style={cell}>{item.name}</td>
                <td style={cell}>{item.proposedStartAt && item.proposedEndAt ? formatPeriod(item.proposedStartAt, item.proposedEndAt) : "—"}</td>
                <td style={cell}>{item.expectedAttendance ?? "—"}</td>
                <td style={cell}>{item.submittedAt ? formatMoment(item.submittedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
