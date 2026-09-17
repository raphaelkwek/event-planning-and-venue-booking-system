import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import DynamicTable from "@atlaskit/dynamic-table";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import { listRequests } from "../api/events.js";
import type { EventListItem } from "../api/types.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";
import { AssignedTo } from "../components/AssignedTo.js";

type Filter = "all" | "mine";

/**
 * A3 — a coordinator's list is every event in the system, whoever it is
 * assigned to and whatever its status, with their own assignments marked. The
 * review queue (D1) is narrower: only what still awaits a decision.
 */
export function AllEvents() {
  const session = useSignedIn();
  const [filter, setFilter] = useState<Filter>("all");
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

  const shown = filter === "mine" ? items.filter((item) => item.assignedCoordinatorId === session.userId) : items;

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

  const rows = shown.map((item) => ({
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
      <h2>All events</h2>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <Button appearance={filter === "all" ? "primary" : "default"} onClick={() => setFilter("all")}>
          Every event
        </Button>
        <Button appearance={filter === "mine" ? "primary" : "default"} onClick={() => setFilter("mine")}>
          Assigned to me
        </Button>
      </div>

      <Refusal error={error} />

      <DynamicTable
        head={head}
        rows={rows}
        isLoading={loading}
        emptyView={<p>{filter === "mine" ? "No events are assigned to you." : "There are no events yet."}</p>}
      />
    </div>
  );
}
