import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "../shared/Lozenge.js";
import TextArea from "@atlaskit/textarea";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import {
  listClarifications,
  listReassignmentProposals,
  openEvent,
  respondToClarification,
} from "../api/events.js";
import type { Clarification, EventRecord, ReassignmentProposal } from "../api/types.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { OutstandingFlags } from "../components/OutstandingFlags.js";
import { StatusHistory } from "../components/StatusHistory.js";
import { Refusal } from "../components/Refusal.js";
import { canEditDetails } from "../shared/eventDetails.js";
import { listChangeRequests, type ChangeRequest } from "../api/changeRequests.js";
import { ChangeRequestForm } from "../components/ChangeRequestForm.js";
import { DecidedChangeNotice } from "../components/ChangeDecision.js";
import { PendingChangeNotice } from "../components/PendingChangeNotice.js";
import { isChangeable } from "../shared/changeRequests.js";
import { EquipmentRequirementsView, VenueRequirementsView } from "../components/Requirements.js";
import { CancelEventAction, CancelledNotice, canCancelEvent } from "../components/CancelEvent.js";

/**
 * The organiser's view of one request: its current status (F2), the
 * clarification thread, the decision outcome (D4/D5), and the reply form that
 * D3 needs.
 */
export function RequestDetail() {
  const session = useSignedIn();
  const navigate = useNavigate();
  // G1: the edit screen comes back here with "Details saved."
  const savedNotice = (useLocation().state as { notice?: string } | null)?.notice ?? null;
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [proposals, setProposals] = useState<ReassignmentProposal[]>([]);
  const [changeRequests, setChangeRequests] = useState<ChangeRequest[]>([]);
  const [changesFailed, setChangesFailed] = useState(false);
  const [requestingChange, setRequestingChange] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const [reply, setReply] = useState("");
  const [amendedAttendance, setAmendedAttendance] = useState("");
  const [replyError, setReplyError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const pendingProposal = proposals.find((proposal) => proposal.status === "PENDING") ?? null;
  const nameOf = useUserNames(session.token, [
    event?.ownerId,
    event?.assignedCoordinatorId,
    event?.reviewingCoordinatorId,
    pendingProposal?.nomineeCoordinatorId,
  ]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      // The event first, then the three lists that follow it together: none depends on another (L11).
      const opened = await openEvent(session.token, id);
      // A failure of the change requests is shown beside the notice's place; it does not hide the page.
      const [clarificationList, proposalList, changes] = await Promise.all([
        listClarifications(session.token, id),
        listReassignmentProposals(session.token, id),
        listChangeRequests(session.token, id).then(
          (list) => list.items,
          () => null
        ),
      ]);
      setEvent(opened);
      setClarifications(clarificationList.items);
      setProposals(proposalList.items);
      setChangeRequests(changes ?? []);
      setChangesFailed(changes === null);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoading(false);
    }
  }, [id, session.token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRespond() {
    if (!id) return;
    setReplyError(null);
    setBusy(true);
    try {
      const amendments =
        amendedAttendance.trim().length > 0
          ? { expectedAttendance: Number(amendedAttendance) }
          : undefined;
      await respondToClarification(session.token, id, {
        message: reply.trim().length > 0 ? reply : undefined,
        amendments,
      });
      setReply("");
      setAmendedAttendance("");
      await load();
    } catch (caught) {
      setReplyError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (error) return <Refusal error={error} />;
  if (!event) return null;

  const pendingChange = changeRequests.find((entry) => entry.status === "PENDING") ?? null;
  // D12 (staging dry run, 4 Nov 2026): every change request the event has had, with its outcome,
  // newest first, not only the latest; a pending one is shown above them.
  const decidedChanges = changeRequests
    .filter((entry) => entry.status !== "PENDING")
    .sort((a, b) => (b.decidedAt ?? b.requestedAt).localeCompare(a.decidedAt ?? a.requestedAt));
  const canRequestChange = !changesFailed && isChangeable(event.status) && event.ownerId === session.userId && !pendingChange;
  const openClarification = clarifications.find((entry) => entry.status === "OPEN");

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 style={{ marginBottom: 4, flex: 1 }}>{event.name}</h2>
          {canEditDetails(event, session) && (
            <Button onClick={() => navigate(`/events/${event.id}/details`)}>Edit details</Button>
          )}
          {/* R2, R4: the window and withdrawal deadline are the owning organiser's to set, while details are editable. */}
          {canEditDetails(event, session) && event.ownerId === session.userId && (
            <Button onClick={() => navigate(`/events/${event.id}/registration`)}>Registration settings</Button>
          )}
          {/* R5 to R7: who has registered, the waitlist, and adding an attendee by hand. */}
          {event.registrationRequired && event.ownerId === session.userId && (
            <Button onClick={() => navigate(`/events/${event.id}/registrations`)}>Registrations</Button>
          )}
          {canRequestChange && !requestingChange && (
            <Button onClick={() => setRequestingChange(true)}>Request a change</Button>
          )}
        </div>
        <p style={{ marginTop: 0, color: "#626F86" }}>{event.reference ?? "No reference yet"}</p>

        {savedNotice && (
          <div style={{ marginBottom: 16 }}>
            <SectionMessage appearance="success">
              <p style={{ margin: 0 }}>{savedNotice}</p>
            </SectionMessage>
          </div>
        )}

        {event.status === "REJECTED" && event.rejectionReason && (
          <div style={{ marginBottom: 16 }}>
            <SectionMessage appearance="error" title="This request was rejected">
              <p style={{ margin: 0 }}>{event.rejectionReason}</p>
              <p style={{ marginBottom: 0, fontSize: 12 }}>
                Decided {formatInstant(event.decidedAt)}. A rejected request cannot be edited or
                resubmitted.
              </p>
            </SectionMessage>
          </div>
        )}

        {event.status === "APPROVED" && (
          <div style={{ marginBottom: 16 }}>
            <SectionMessage appearance="success" title="This request was approved">
              <p style={{ margin: 0 }}>Approved {formatInstant(event.decidedAt)}.</p>
            </SectionMessage>
          </div>
        )}

        <CancelledNotice event={event} />

        {changesFailed && <p role="status" style={{ color: "#626F86", fontSize: 13 }}>Change requests couldn't be loaded.</p>}
        {pendingChange && <PendingChangeNotice request={pendingChange} />}
        {decidedChanges.length > 0 && (
          <section aria-labelledby="change-requests-heading" style={{ marginBottom: 16 }}>
            <h3 id="change-requests-heading" style={{ marginTop: 0 }}>
              Change requests
            </h3>
            {decidedChanges.map((entry) => (
              <DecidedChangeNotice key={entry.id} request={entry} />
            ))}
          </section>
        )}
        {canRequestChange && requestingChange && (
          <ChangeRequestForm
            event={event}
            token={session.token}
            onCancel={() => setRequestingChange(false)}
            onSent={() => {
              setRequestingChange(false);
              void load();
            }}
          />
        )}

        <Detail label="Purpose" value={event.purpose} />
        <Detail label="Description" value={event.description} />
        <Detail label="Proposed start" value={formatInstant(event.proposedStartAt)} />
        <Detail label="Proposed end" value={formatInstant(event.proposedEndAt)} />
        <Detail
          label="Expected attendance"
          value={event.expectedAttendance === null ? null : String(event.expectedAttendance)}
        />
        <Detail label="Accessibility needs" value={event.accessibilityNeeds} />
        <Detail label="Contact details" value={event.contactDetails} />
        <VenueRequirementsView value={event.venueRequirements} />
        <EquipmentRequirementsView required={event.equipmentRequired} lines={event.equipmentRequirements} />
        <Detail
          label="Registration required"
          value={event.registrationRequired ? "Yes" : "No"}
        />

        <OutstandingFlags eventId={event.id} refreshKey={event.status} />
        <StatusHistory eventId={event.id} refreshKey={event.status} />
        <h3 style={{ marginTop: 32 }}>Clarifications</h3>
        {clarifications.length === 0 && <p>None requested.</p>}
        {clarifications.map((entry) => (
          <div
            key={entry.id}
            style={{
              border: "1px solid #DFE1E6",
              borderRadius: 4,
              padding: 12,
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Coordinator asked</strong>
              <span style={{ fontSize: 12, color: "#626F86" }}>
                {formatInstant(entry.requestedAt)}
              </span>
            </div>
            <p style={{ marginTop: 4 }}>{entry.message}</p>

            {entry.status === "RESPONDED" ? (
              <div style={{ borderLeft: "3px solid #DFE1E6", paddingLeft: 12, marginTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <strong>Organiser replied</strong>
                  <span style={{ fontSize: 12, color: "#626F86" }}>
                    {formatInstant(entry.respondedAt)}
                  </span>
                </div>
                <p style={{ marginTop: 4, marginBottom: 0 }}>
                  {entry.responseMessage ?? <em>Amended the request without a message.</em>}
                </p>
              </div>
            ) : (
              <Lozenge appearance="moved">Awaiting your response</Lozenge>
            )}
          </div>
        ))}

        {openClarification && (
          <div style={{ marginTop: 16 }}>
            <h4>Respond</h4>
            <p style={{ fontSize: 12, color: "#626F86", marginTop: 0 }}>
              Reply with a message, amend the request, or both. Neither is refused.
            </p>
            <TextArea
              value={reply}
              minimumRows={3}
              placeholder="Your reply"
              onChange={(e) => setReply((e.target as HTMLTextAreaElement).value)}
            />
            <div style={{ marginTop: 8, maxWidth: 240 }}>
              {/* Labelled with htmlFor/id: unlabelled, axe reports a critical "label" violation (EN-14). */}
              <label htmlFor="amend-attendance" style={{ fontSize: 12, fontWeight: 600 }}>
                Amend expected attendance (optional)
              </label>
              <Textfield
                id="amend-attendance"
                type="number"
                value={amendedAttendance}
                onChange={(e) => setAmendedAttendance((e.target as HTMLInputElement).value)}
              />
            </div>
            <div style={{ marginTop: 12 }}>
              <Button appearance="primary" onClick={onRespond} isDisabled={busy}>
                Send response
              </Button>
            </div>
            <div style={{ marginTop: 12 }}>
              <Refusal error={replyError} />
            </div>
          </div>
        )}
      </div>

      <aside style={{ flex: 1, borderLeft: "1px solid #DFE1E6", paddingLeft: 24 }}>
        <h3 style={{ marginTop: 0 }}>Status</h3>
        <Lozenge appearance={STATUS_APPEARANCE[event.status]}>{STATUS_LABELS[event.status]}</Lozenge>

        {/* F3 — the owner, until the event is Completed, Rejected or Cancelled. */}
        {canCancelEvent(event, session) && (
          <div style={{ marginTop: 12 }}>
            <CancelEventAction eventId={event.id} token={session.token} onCancelled={() => void load()} />
          </div>
        )}

        <dl style={{ fontSize: 13 }}>
          <Meta label="Submitted" value={formatInstant(event.submittedAt)} />
          <Meta label="Last saved" value={formatInstant(event.lastSavedAt)} />
          <Meta label="Organiser" value={nameOf(event.ownerId)!} />
          <Meta label="Assigned coordinator" value={nameOf(event.assignedCoordinatorId) ?? "Awaiting assignment"} />
          <Meta label="Reviewing coordinator" value={nameOf(event.reviewingCoordinatorId) ?? "—"} />
          <Meta label="Decision" value={event.decidedAt ? formatInstant(event.decidedAt) : "None yet"} />
        </dl>

        {/* E2 — read-only for the organiser: no accept/decline actions here. */}
        {pendingProposal && (
          <div style={{ marginTop: 16 }}>
            <Lozenge appearance="moved">Pending reassignment</Lozenge>
            <p style={{ fontSize: 13, marginTop: 4 }}>
              Proposed to {nameOf(pendingProposal.nomineeCoordinatorId)} on{" "}
              {formatInstant(pendingProposal.proposedAt)}.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#626F86" }}>{label}</div>
      <div>{value && value.length > 0 ? value : "—"}</div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt style={{ fontWeight: 600, color: "#626F86", marginTop: 12 }}>{label}</dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </>
  );
}
