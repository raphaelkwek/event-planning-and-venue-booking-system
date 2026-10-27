import { useEffect, useState } from "react";
import Lozenge from "@atlaskit/lozenge";
import { useSignedIn } from "../auth/SessionContext.js";
import { getStatusHistory, type StatusHistoryEntry } from "../api/statusHistory.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { useUserNames } from "../shared/useUserNames.js";
import { Refusal } from "./Refusal.js";

const ROLE_LABELS: Record<string, string> = {
  EVENT_ORGANISER: "Event Organiser",
  EVENT_COORDINATOR: "Event Coordinator",
  EVENT_COORDINATOR_LEAD: "Event Coordinator Lead",
  VENUE_STAFF: "Venue Staff",
  TECH_SUPPORT_STAFF: "Technical Support",
  ATTENDEE: "Attendee",
  SYSTEM: "System",
};

function StatusCell({ status }: { status: StatusHistoryEntry["newStatus"] | null }) {
  if (!status) return <span>—</span>;
  return <Lozenge appearance={STATUS_APPEARANCE[status]}>{STATUS_LABELS[status]}</Lozenge>;
}

/**
 * F2 — an event's status history: previous status, new status, the acting
 * user's role and the time of each change, oldest first. It is read only by
 * construction: no row offers an edit or a delete, and the API has no route
 * that would honour one. `refreshKey` reloads it after an action changes the
 * status.
 */
export function StatusHistory({ eventId, refreshKey }: { eventId: string; refreshKey?: unknown }) {
  const session = useSignedIn();
  const [entries, setEntries] = useState<StatusHistoryEntry[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const nameOf = useUserNames(session.token, entries?.map((entry) => entry.actorUserId) ?? []);

  const actorName = (entry: StatusHistoryEntry) => {
    const name = nameOf(entry.actorUserId);
    return name && name !== entry.actorUserId ? name : null;
  };

  useEffect(() => {
    let active = true;
    setError(null);
    getStatusHistory(session.token, eventId)
      .then((history) => active && setEntries(history.items))
      .catch((caught) => active && setError(caught));
    return () => {
      active = false;
    };
  }, [eventId, session.token, refreshKey]);

  return (
    <section aria-labelledby="status-history-heading" style={{ marginTop: 32 }}>
      <h3 id="status-history-heading">Status history</h3>
      <Refusal error={error} />
      {!error && entries === null && <p>Loading…</p>}
      {entries && entries.length === 0 && <p>No status changes recorded.</p>}
      {entries && entries.length > 0 && (
        <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", color: "#626F86" }}>
              <th scope="col">From</th>
              <th scope="col">To</th>
              <th scope="col">By</th>
              <th scope="col">When</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderTop: "1px solid #DFE1E6" }}>
                <td>
                  <StatusCell status={entry.previousStatus} />
                </td>
                <td>
                  <StatusCell status={entry.newStatus} />
                </td>
                <td>
                  {ROLE_LABELS[entry.actorRole] ?? entry.actorRole}
                  {actorName(entry) ? ` (${actorName(entry)})` : ""}
                </td>
                <td>{formatInstant(entry.occurredAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
