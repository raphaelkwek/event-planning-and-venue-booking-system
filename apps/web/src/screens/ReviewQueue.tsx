import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Lozenge from "@atlaskit/lozenge";
import DynamicTable from "@atlaskit/dynamic-table";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import { listQueue } from "../api/events.js";
import type { EventRecord } from "../api/types.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";
import { AssignedTo } from "../components/AssignedTo.js";

/**
 * D1 — every request awaiting a decision, oldest submission first. Drafts
 * never appear here, and neither does a request that already carries one.
 */
export function ReviewQueue() {
  const session = useSignedIn();
  const [items, setItems] = useState<EventRecord[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const nameOf = useUserNames(
    session.token,
    items.flatMap((item) => [item.ownerId, item.assignedCoordinatorId])
  );

  useEffect(() => {
    listQueue(session.token)
      .then((page) => setItems(page.items))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [session.token]);

  const head = {
    cells: [
      { key: "reference", content: "Reference" },
      { key: "name", content: "Name" },
      { key: "when", content: "Proposed" },
      { key: "attendance", content: "Attendance" },
      { key: "organiser", content: "Organiser" },
      { key: "submitted", content: "Submitted" },
      { key: "status", content: "Status" },
      { key: "assigned", content: "Assigned to" },
      { key: "actions", content: "" },
    ],
  };

  const rows = items.map((item) => ({
    key: item.id,
    cells: [
      { key: "reference", content: item.reference },
      { key: "name", content: item.name },
      { key: "when", content: formatInstant(item.proposedStartAt) },
      { key: "attendance", content: item.expectedAttendance },
      { key: "organiser", content: nameOf(item.ownerId) },
      { key: "submitted", content: formatInstant(item.submittedAt) },
      {
        key: "status",
        content: (
          <Lozenge appearance={STATUS_APPEARANCE[item.status]}>{STATUS_LABELS[item.status]}</Lozenge>
        ),
      },
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
      <h2 style={{ marginBottom: 16 }}>Review queue</h2>
      <div style={{ marginBottom: 16 }}>
        <SectionMessage appearance="information">
          <p style={{ margin: 0 }}>
            Ordered oldest first. Opening a Submitted request moves it to Under Review and records
            you as its reviewer. If another coordinator opened it first, they remain the reviewer.
          </p>
        </SectionMessage>
      </div>

      <Refusal error={error} />

      <DynamicTable
        head={head}
        rows={rows}
        isLoading={loading}
        emptyView={<p>Nothing is awaiting a decision.</p>}
      />
    </div>
  );
}
