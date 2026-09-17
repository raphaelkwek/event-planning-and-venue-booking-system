import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import DynamicTable from "@atlaskit/dynamic-table";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import { listRequests } from "../api/events.js";
import type { EventListItem } from "../api/types.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";

type Filter = "all" | "drafts" | "submitted";

/**
 * C3 — drafts and submitted requests in one list, each showing its status, so
 * an unfinished request is never mistaken for one under review. A draft row
 * shows its last-saved time and no reference, coordinator or outcome.
 */
export function MyRequests() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<Filter>("all");
  const [items, setItems] = useState<EventListItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const nameOf = useUserNames(
    session.token,
    items.map((item) => item.assignedCoordinatorId)
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    listRequests(session.token, filter === "all" ? undefined : filter)
      .then((page) => setItems(page.items))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [session.token, filter]);

  const head = {
    cells: [
      { key: "reference", content: "Reference" },
      { key: "name", content: "Name", isSortable: true },
      { key: "status", content: "Status" },
      { key: "saved", content: "Last saved" },
      { key: "submitted", content: "Submitted" },
      { key: "coordinator", content: "Coordinator" },
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
      { key: "saved", content: formatInstant(item.lastSavedAt) },
      { key: "submitted", content: formatInstant(item.submittedAt) },
      { key: "coordinator", content: nameOf(item.assignedCoordinatorId) ?? "—" },
      {
        key: "actions",
        content:
          item.status === "DRAFT" ? (
            <Link to={`/drafts/${item.id}`}>Open draft</Link>
          ) : (
            <Link to={`/requests/${item.id}`}>View</Link>
          ),
      },
    ],
  }));

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <h2 style={{ margin: 0, flex: 1 }}>My requests</h2>
        {/* A button that navigates, not a button nested in a link — nested
            interactive elements are invalid and announced twice by screen readers. */}
        <Button appearance="primary" onClick={() => navigate("/drafts/new")}>
          New request
        </Button>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["all", "drafts", "submitted"] as Filter[]).map((option) => (
          <Button
            key={option}
            appearance={filter === option ? "primary" : "default"}
            onClick={() => setFilter(option)}
          >
            {option === "all" ? "All" : option === "drafts" ? "Drafts only" : "Submitted and later"}
          </Button>
        ))}
      </div>

      <Refusal error={error} />

      <DynamicTable
        head={head}
        rows={rows}
        isLoading={loading}
        emptyView={<p>No requests yet. Create one to get started.</p>}
      />
    </div>
  );
}
