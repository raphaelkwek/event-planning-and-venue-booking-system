import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import {
  assignCoordinator,
  listAssignmentHistory,
  listCoordinators,
  reassignCoordinator,
  type AssignmentHistoryEntry,
  type Coordinator,
} from "../api/assignments.js";
import { openEvent } from "../api/events.js";
import type { EventRecord, EventStatus } from "../api/types.js";
import { useUserNames } from "../shared/useUserNames.js";
import { formatMoment, formatPeriod } from "../shared/singaporeTime.js";
import { STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";

const coordinatorName = (c: Coordinator) => c.displayName ?? c.email;
const cell = { padding: "6px 8px", borderBottom: "1px solid #DFE1E6", textAlign: "left" as const, verticalAlign: "top" as const };

/** No coordinator is assigned to, or moved from, an event that is a draft or has left the workflow (E3, E4). */
const CLOSED: EventStatus[] = ["DRAFT", "COMPLETED", "CANCELLED", "REJECTED"];

/**
 * E3, E4, E5 — the Lead opens a request and sees its basic information, then assigns
 * it to one active Event Coordinator, or reassigns it to another at once, and
 * reads its assignment history. Opening it here never claims it for review.
 */
export function AssignmentDetail() {
  const session = useSignedIn();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [coordinators, setCoordinators] = useState<Coordinator[]>([]);
  const [chosen, setChosen] = useState("");
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [missing, setMissing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<AssignmentHistoryEntry[]>([]);
  const nameOf = useUserNames(session.token, [
    event?.ownerId,
    event?.assignedCoordinatorId,
    ...history.flatMap((entry) => [entry.coordinatorId, entry.assignedBy]),
  ]);

  const loadHistory = () =>
    listAssignmentHistory(session.token, eventId!)
      .then((page) => setHistory(page.items))
      .catch(setLoadError);

  useEffect(() => {
    openEvent(session.token, eventId!).then(setEvent).catch(setLoadError);
    listCoordinators(session.token)
      .then((page) => setCoordinators(page.items))
      .catch(setLoadError);
    void loadHistory();
    // loadHistory reads only the token and the event id, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, eventId]);

  async function onAssign(e: FormEvent) {
    e.preventDefault();
    setActionError(null);
    setNotice(null);
    if (!chosen) {
      setMissing(true);
      return;
    }
    setMissing(false);
    setBusy(true);
    try {
      // E4: an event with a coordinator is reassigned, at once; one without is assigned (E3).
      const reassigning = Boolean(event?.assignedCoordinatorId);
      const result = reassigning
        ? await reassignCoordinator(session.token, eventId!, chosen)
        : await assignCoordinator(session.token, eventId!, chosen);
      const who = coordinators.find((c) => c.id === result.coordinatorId);
      const name = who ? coordinatorName(who) : "the coordinator";
      setNotice(reassigning ? `Reassigned to ${name}. They are now the event's coordinator.` : `Assigned to ${name}.`);
      setEvent((current) => (current ? { ...current, assignedCoordinatorId: result.coordinatorId } : current));
      setChosen("");
      void loadHistory();
    } catch (error) {
      setActionError(error);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <Refusal error={loadError} />;
  if (!event) return <p>Loading…</p>;

  const assignedTo = event.assignedCoordinatorId;
  const assignedName = coordinators.find((c) => c.id === assignedTo);

  return (
    <div>
      <p>
        <Link to="/assignments/unassigned">Back to unassigned requests</Link>
      </p>
      <h2 style={{ marginBottom: 8 }}>{event.name}</h2>
      <p>
        {event.reference} · <Lozenge appearance={STATUS_APPEARANCE[event.status]}>{STATUS_LABELS[event.status]}</Lozenge>
      </p>
      <dl style={{ display: "grid", gridTemplateColumns: "max-content 1fr", gap: "4px 16px" }}>
        <dt>Purpose</dt>
        <dd style={{ margin: 0 }}>{event.purpose ?? "—"}</dd>
        <dt>Proposed</dt>
        <dd style={{ margin: 0 }}>{event.proposedStartAt && event.proposedEndAt ? formatPeriod(event.proposedStartAt, event.proposedEndAt) : "—"}</dd>
        <dt>Expected attendance</dt>
        <dd style={{ margin: 0 }}>{event.expectedAttendance ?? "—"}</dd>
        <dt>Organiser</dt>
        <dd style={{ margin: 0 }}>{nameOf(event.ownerId) ?? "—"}</dd>
        <dt>Submitted</dt>
        <dd style={{ margin: 0 }}>{event.submittedAt ? formatMoment(event.submittedAt) : "—"}</dd>
        <dt>Coordinator</dt>
        <dd style={{ margin: 0 }}>{assignedTo ? (assignedName ? coordinatorName(assignedName) : nameOf(assignedTo)) : "Unassigned"}</dd>
      </dl>

      {notice && (
        <div style={{ margin: "16px 0" }}>
          <SectionMessage appearance="success">
            <p>{notice}</p>
          </SectionMessage>
        </div>
      )}

      {!CLOSED.includes(event.status) && (
        <form onSubmit={(e) => void onAssign(e)} style={{ marginTop: 24 }}>
          <h3>{assignedTo ? "Reassign to another coordinator" : "Assign a coordinator"}</h3>
          {assignedTo && (
            <p>The new coordinator takes over at once, with no acceptance; the current one no longer coordinates the event.</p>
          )}
          <label htmlFor="assign-coordinator" style={{ display: "block", marginBottom: 4 }}>
            {assignedTo ? "New coordinator" : "Coordinator"}
          </label>
          <select id="assign-coordinator" value={chosen} onChange={(e) => setChosen(e.target.value)}>
            <option value="">Choose a coordinator</option>
            {coordinators
              .filter((c) => c.id !== assignedTo)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {`${coordinatorName(c)} (${c.activeAssignments} active)`}
                </option>
              ))}
          </select>
          {missing && <p style={{ color: "#AE2E24" }}>Choose a coordinator to assign.</p>}
          <div style={{ marginTop: 12 }}>
            <Button type="submit" appearance="primary" isDisabled={busy}>
              {assignedTo ? "Reassign" : "Assign"}
            </Button>
          </div>
        </form>
      )}
      <Refusal error={actionError} />

      <h3 style={{ marginTop: 32 }}>Assignment history</h3>
      {history.length === 0 ? (
        <p>No coordinator has been assigned yet.</p>
      ) : (
        <table aria-label="Assignment history" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Coordinator", "Assigned by", "From", "Until"].map((heading) => (
                <th key={heading} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {history.map((entry) => (
              <tr key={`${entry.coordinatorId}-${entry.assignedAt}`}>
                <td style={cell}>{nameOf(entry.coordinatorId)}</td>
                <td style={cell}>{entry.assignedBy ? nameOf(entry.assignedBy) : "Automatically on submission (E1)"}</td>
                <td style={cell}>{formatMoment(entry.assignedAt)}</td>
                <td style={cell}>{entry.endedAt ? formatMoment(entry.endedAt) : "Current"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
