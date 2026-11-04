import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Lozenge from "../shared/Lozenge.js";
import DynamicTable from "@atlaskit/dynamic-table";
import Textfield from "@atlaskit/textfield";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import { listRequests } from "../api/events.js";
import type { EventListItem, EventStatus } from "../api/types.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { LoadFailure } from "../components/LoadFailure.js";
import { AssignedTo } from "../components/AssignedTo.js";

/**
 * A4 (CR-05) — a coordinator's list is every event assigned to them, whatever its
 * status. The server returns no other (A3's "every event in the system" is
 * superseded), so there is nothing to filter by coordinator. The review queue (D1)
 * is narrower: only what still awaits a decision.
 *
 * D11 (staging dry run, 4 Nov 2026): the list can be searched by part of an event's
 * name or reference, ignoring case, and narrowed to one status. The list holds every
 * page (listRequests follows them), so both apply to all of it. Both live in the
 * address (`?q=`, `?status=`), so a filtered list survives a reload and can be shared.
 */
// A coordinator is assigned only submitted events, so a draft is never in this list.
const STATUSES = (Object.keys(STATUS_LABELS) as EventStatus[]).filter((value) => value !== "DRAFT");

function matchesSearch(item: EventListItem, query: string): boolean {
  const wanted = query.trim().toLowerCase();
  if (wanted === "") return true;
  return item.name.toLowerCase().includes(wanted) || (item.reference ?? "").toLowerCase().includes(wanted);
}

export function AllEvents() {
  const session = useSignedIn();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const status = (STATUSES as string[]).includes(params.get("status") ?? "") ? (params.get("status") as EventStatus) : "";
  const [items, setItems] = useState<EventListItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const nameOf = useUserNames(session.token, items.map((item) => item.assignedCoordinatorId));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listRequests(session.token)
      .then((page) => setItems(page.items))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [session.token]);

  useEffect(load, [load]);

  /** Sets one filter in the address, dropping it when blank, and keeps the other. */
  const setFilter = (key: "q" | "status", value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value === "") next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  const shown = items.filter((item) => matchesSearch(item, query) && (status === "" || item.status === status));
  const filtering = query.trim() !== "" || status !== "";

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
      <h2 style={{ marginBottom: 16 }}>All events</h2>

      <form role="search" aria-label="Find an event" onSubmit={(e) => e.preventDefault()} style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 16 }}>
        <div style={{ minWidth: 260 }}>
          <label htmlFor="all-events-q" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Search by name or reference
          </label>
          <Textfield id="all-events-q" value={query} placeholder="e.g. Symposium or EVT-000123" onChange={(e) => setFilter("q", e.currentTarget.value)} />
        </div>
        <div>
          <label htmlFor="all-events-status" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Status
          </label>
          <select
            id="all-events-status"
            value={status}
            onChange={(e) => setFilter("status", e.currentTarget.value)}
            style={{ padding: "6px 8px", border: "2px solid #DFE1E6", borderRadius: 3, font: "inherit", background: "#fff" }}
          >
            <option value="">All statuses</option>
            {STATUSES.map((value) => (
              <option key={value} value={value}>
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>
      </form>

      {/* D10: a failed load is one error with Try again, in place of the list. */}
      {error ? (
        <LoadFailure error={error} what="Your events" onRetry={load} />
      ) : (
        <DynamicTable
          head={head}
          rows={rows}
          isLoading={loading}
          emptyView={<p>{filtering && items.length > 0 ? "No events match the search and status filter." : "No events are assigned to you."}</p>}
        />
      )}
    </div>
  );
}
