import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSignedIn } from "../auth/SessionContext.js";
import { listSafetyReviews, type SafetyQueueEntry } from "../api/safetyReviews.js";
import { formatMoment, formatPeriod } from "../shared/singaporeTime.js";
import { Refusal } from "../components/Refusal.js";

const cell = { padding: "6px 8px", borderBottom: "1px solid #DFE1E6", textAlign: "left" as const, verticalAlign: "top" as const };

/**
 * U1 — the Safety Officer's queue: every event in Safety Review, the longest-waiting first, as the
 * server orders them. An event the officer has approved stays here until its coordinator marks it
 * Confirmed.
 */
export function SafetyQueue() {
  const session = useSignedIn();
  const [items, setItems] = useState<SafetyQueueEntry[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    listSafetyReviews(session.token)
      .then((page) => setItems(page.events))
      .catch(setError);
  }, [session.token]);

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Safety queue</h2>
      <p>Each event waits here for your safety decision once its venue and equipment arrangements are confirmed.</p>
      <Refusal error={error} />
      {items !== null && items.length === 0 && <p>No events are waiting for a safety decision.</p>}
      {items !== null && items.length > 0 && (
        <table aria-label="Events in Safety Review" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Reference", "Name", "Period", "Attendance", "In Safety Review since", "Decision"].map((heading) => (
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
                  <Link to={`/safety/${item.id}`}>{item.reference ?? item.id}</Link>
                </td>
                <td style={cell}>{item.name}</td>
                <td style={cell}>{item.proposedStartAt && item.proposedEndAt ? formatPeriod(item.proposedStartAt, item.proposedEndAt) : "—"}</td>
                <td style={cell}>{item.expectedAttendance ?? "—"}</td>
                <td style={cell}>{formatMoment(item.enteredSafetyReviewAt)}</td>
                <td style={cell}>{item.decision === "APPROVE" ? "Approved, awaiting Mark Confirmed" : "Awaiting your decision"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
