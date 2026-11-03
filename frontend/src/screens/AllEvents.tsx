import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Lozenge from "@atlaskit/lozenge";
import DynamicTable from "@atlaskit/dynamic-table";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import { listRequests } from "../api/events.js";
import type { EventListItem } from "../api/types.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";
import { AssignedTo } from "../components/AssignedTo.js";

/**
 * A4 (CR-05) — a coordinator's list is every event assigned to them, whatever its
 * status. The server returns no other (A3's "every event in the system" is
 * superseded), so there is nothing left to filter. The review queue (D1) is
 * narrower: only what still awaits a decision.
 */
export function AllEvents() {
  const session = useSignedIn();
  const [items, setItems] = useState<EventListItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const nameOf = useUserNames(session.token, items.map((item) => item.assignedCoordinatorId));

  useEffect(() => {
    listRequests(session.token)
      .then((page) => setItems(page.items))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [session.token]);

  const head = {
    cells: [
      { key: "reference", content: "Reference" },
      { key: "name", content: "Name" },
      { key: "status", content: "Status" },
      { key: "submitted", content: "Submitted" },
      { key: "assigned", content: "Assigned to" },
      { key: "actions", content: "" },
    ],
  };

  const rows = items.map((item) => ({
    key: item.id,
    cells: [
      { key: "reference", content: item.reference ?? "—" },
      { key: "name", content: item.name },
      {
        key: "status",
        content: (
          <Lozenge appearance={STATUS_APPEARANCE[item.status]}>{STATUS_LABELS[item.status]}</Lozenge>
        ),
      },
      { key: "submitted", content: formatInstant(item.submittedAt) },
      {
        key: "assigned",
        content: (
          <AssignedTo coordinatorId={item.assignedCoordinatorId} currentUserId={session.userId} nameOf={nameOf} />
        ),
      },
      { key: "actions", content: <Link to={`/review/${item.id}`}>Open</Link> },
    ],
  }));

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>All events</h2>

      <Refusal error={error} />

      <DynamicTable
        head={head}
        rows={rows}
        isLoading={loading}
        emptyView={<p>No events are assigned to you.</p>}
      />
    </div>
  );
}
