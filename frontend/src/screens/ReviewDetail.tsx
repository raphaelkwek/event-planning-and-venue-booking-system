import { useCallback, useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "../shared/Lozenge.js";
import TextArea from "@atlaskit/textarea";
import SectionMessage from "@atlaskit/section-message";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import {
  approveEvent,
  listClarifications,
  listReassignmentProposals,
  openEvent,
  rejectEvent,
  requestClarification,
} from "../api/events.js";
import type { Clarification, EventRecord, ReassignmentProposal } from "../api/types.js";
import { ApiError } from "../api/client.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { StatusHistory } from "../components/StatusHistory.js";
import { Refusal } from "../components/Refusal.js";
import { canEditDetails } from "../shared/eventDetails.js";
import { getChangeImpact, listChangeRequests, type ChangeImpact, type ChangeRequest } from "../api/changeRequests.js";
import { ChangeDecisionActions, DecidedChangeNotice } from "../components/ChangeDecision.js";
import { PendingChangeNotice } from "../components/PendingChangeNotice.js";
import { EquipmentRequirementsView, VenueRequirementsView } from "../components/Requirements.js";
import { ActiveRegistrations } from "../components/ActiveRegistrations.js";
import { ChangeImpactView } from "../components/ChangeImpactView.js";
import { OutstandingFlags } from "../components/OutstandingFlags.js";
import { ConfirmArrangementsAction } from "../components/ConfirmArrangements.js";
import { MarkConfirmedAction } from "../components/MarkConfirmed.js";
import { CancelEventAction, CancelledNotice, canCancelEvent } from "../components/CancelEvent.js";

/** G2 — what approving the pending change would affect, read-only; hidden once the request is decided or not visible to this user. */
function ChangeImpactPreview({ token, requestId, eventId }: { token: string; requestId: string; eventId: string }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "error" } | { status: "hidden" } | { status: "ready"; impact: ChangeImpact }>({ status: "loading" });
  useEffect(() => {
    let current = true;
    setState({ status: "loading" });
    getChangeImpact(token, requestId).then(
      (result) => {
        if (current) setState(result?.impact ? { status: "ready", impact: result.impact } : { status: "hidden" });
      },
      (caught) => {
        if (!current) return;
        const gone = caught instanceof ApiError && (caught.status === 409 || caught.status === 404);
        setState({ status: gone ? "hidden" : "error" });
      }
    );
    return () => {
      current = false;
    };
  }, [token, requestId]);

  if (state.status === "hidden") return null;
  if (state.status === "loading") return <p role="status" style={{ color: "#626F86", fontSize: 13 }}>Loading what this change would affect…</p>;
  if (state.status === "error") return <p role="status" style={{ color: "#626F86", fontSize: 13 }}>What this change would affect couldn't be loaded.</p>;
  return (
    <ChangeImpactView
      impact={state.impact}
      registrations={<ActiveRegistrations token={token} eventId={eventId} />}
      heading="If this change is approved"
      emptyText="No venue bookings or equipment reservations would be affected."
    />
  );
}

/**
 * D1, D2, D4, D5 — the coordinator's review screen.
 *
 * Simply opening this screen is what moves a Submitted request to Under Review
 * and records the reviewer (D1), so the read is the action.
 */
export function ReviewDetail() {
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
  // S3: the impact returned by an approval made on this screen, with the change request it decided; the
  // approval refreshes the page, so it is kept here. It is shown only while that request is still the
  // latest decided one and no other change is pending, so a later change never shows a stale impact.
  const [impact, setImpact] = useState<{ requestId: string; impact: ChangeImpact } | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [message, setMessage] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  // Kept apart from actionError: a refusal of the rejection is shown in the
  // dialog, where the reason is entered, not on the page behind it.
  const [rejectError, setRejectError] = useState<unknown>(null);


  const pendingProposal = proposals.find((proposal) => proposal.status === "PENDING") ?? null;
  const nameOf = useUserNames(session.token, [
    event?.ownerId,
    event?.assignedCoordinatorId,
    event?.reviewingCoordinatorId,
    event?.decidedBy,
    pendingProposal?.nomineeCoordinatorId,
  ]);

  /**
   * The first read shows "Loading…". D6 (staging dry run, 4 Nov 2026): every read after an action is
   * `quiet`: the page stays as it is, already showing the action's own answer, while the rest catches
   * up, and a failure of that refresh is shown beside the page rather than in place of it.
   */
  const load = useCallback(async (options: { quiet?: boolean } = {}) => {
    if (!id) return;
    if (!options.quiet) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      // The event first: a coordinator opening a Submitted one claims it for review (D1). The three
      // lists that follow don't depend on each other, so they are fetched together (L11).
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
      if (options.quiet) setActionError(caught);
      else setLoadError(caught);
    } finally {
      setLoading(false);
    }
  }, [id, session.token]);
  const refresh = useCallback(() => void load({ quiet: true }), [load]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs an action; the screen shows its answer at once and refreshes the rest quietly behind it (D6). */
  async function run(action: () => Promise<unknown>, onError: (error: unknown) => void = setActionError) {
    onError(null);
    setBusy(true);
    try {
      await action();
      refresh();
      return true;
    } catch (caught) {
      onError(caught);
      return false;
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (loadError) return <Refusal error={loadError} />;
  if (!event) return null;

  const pendingChange = changeRequests.find((entry) => entry.status === "PENDING") ?? null;
  const latestDecided =
    changeRequests
      .filter((entry) => entry.status !== "PENDING" && entry.decidedAt)
      .sort((a, b) => (b.decidedAt ?? "").localeCompare(a.decidedAt ?? ""))[0] ?? null;
  const decided = event.decidedAt !== null;
  // D8: the banner is the decision's, so it shows only while the decision is the event's status.
  const showDecision = decided && (event.status === "APPROVED" || event.status === "REJECTED");
  const reviewedBySomeoneElse =
    event.reviewingCoordinatorId !== null && event.reviewingCoordinatorId !== session.userId;

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <h2 style={{ marginBottom: 4, flex: 1 }}>{event.name}</h2>
          {canEditDetails(event, session) && (
            <Button onClick={() => navigate(`/events/${event.id}/details`)}>Edit details</Button>
          )}
          {/* R5 to R7: the assigned coordinator sees the registrations and may add attendees. */}
          {event.registrationRequired && event.assignedCoordinatorId === session.userId && (
            <Button onClick={() => navigate(`/events/${event.id}/registrations`)}>Registrations</Button>
          )}
        </div>
        <p style={{ marginTop: 0, color: "#626F86" }}>
          {event.reference} · <Link to={`/events/${event.id}/equipment`}>Equipment request</Link>
          {event.assignedCoordinatorId === session.userId && (
            <>
              {" · "}
              <Link to={`/events/${event.id}/venue-requests`}>Venue requests</Link>
            </>
          )}
        </p>

        {savedNotice && (
          <div style={{ marginBottom: 16 }}>
            <SectionMessage appearance="success">
              <p style={{ margin: 0 }}>{savedNotice}</p>
            </SectionMessage>
          </div>
        )}

        {reviewedBySomeoneElse && (
          <div style={{ marginBottom: 16 }}>
            <SectionMessage appearance="warning" title="Already under review">
              <p style={{ margin: 0 }}>
                {nameOf(event.reviewingCoordinatorId)} opened this request first,
                and remains the recorded reviewer.
              </p>
            </SectionMessage>
          </div>
        )}

        {showDecision && (
          <div style={{ marginBottom: 16 }}>
            <SectionMessage
              appearance={event.status === "APPROVED" ? "success" : "error"}
              title={`This request is ${STATUS_LABELS[event.status]}`}
            >
              <p style={{ margin: 0 }}>
                Decided {formatInstant(event.decidedAt)} by {nameOf(event.decidedBy)}.
                {event.rejectionReason ? ` Reason: ${event.rejectionReason}` : ""}
              </p>
              <p style={{ marginBottom: 0, fontSize: 12 }}>
                A request that already carries a decision cannot be decided again.
              </p>
            </SectionMessage>
          </div>
        )}

        <CancelledNotice event={event} />

        {changesFailed && <p role="status" style={{ color: "#626F86", fontSize: 13 }}>Change requests couldn't be loaded.</p>}
        {pendingChange && (
          <section role="region" aria-label="Pending change">
            <PendingChangeNotice request={pendingChange} />
            <ChangeImpactPreview key={pendingChange.id} token={session.token} requestId={pendingChange.id} eventId={event.id} />
            {event.assignedCoordinatorId === session.userId && (
              <div style={{ marginBottom: 16, marginTop: -8 }}>
                <ChangeDecisionActions request={pendingChange} token={session.token} onDecided={(result) => {
                    setImpact(result ? { requestId: pendingChange.id, impact: result } : null);
                    refresh();
                  }} />
              </div>
            )}
          </section>
        )}
        {!pendingChange && latestDecided && <DecidedChangeNotice request={latestDecided} />}
        {!pendingChange && impact && latestDecided?.id === impact.requestId && <ChangeImpactView impact={impact.impact} registrations={<ActiveRegistrations token={session.token} eventId={event.id} />} />}

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
        <Detail label="Registration required" value={event.registrationRequired ? "Yes" : "No"} />

        <OutstandingFlags eventId={event.id} refreshKey={`${event.status}/${latestDecided?.id ?? ""}`} />
        <StatusHistory eventId={event.id} refreshKey={event.status} />
        <h3 style={{ marginTop: 32 }}>Clarifications</h3>
        {clarifications.length === 0 && <p>None requested.</p>}
        {clarifications.map((entry) => (
          <div
            key={entry.id}
            style={{ border: "1px solid #DFE1E6", borderRadius: 4, padding: 12, marginBottom: 12 }}
          >
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>Asked</strong>
              <span style={{ fontSize: 12, color: "#626F86" }}>{formatInstant(entry.requestedAt)}</span>
            </div>
            <p style={{ marginTop: 4 }}>{entry.message}</p>
            {entry.status === "RESPONDED" ? (
              <div style={{ borderLeft: "3px solid #DFE1E6", paddingLeft: 12 }}>
                <strong>Organiser replied</strong> ({formatInstant(entry.respondedAt)})
                <p style={{ marginTop: 4, marginBottom: 0 }}>
                  {entry.responseMessage ?? <em>Amended the request without a message.</em>}
                </p>
              </div>
            ) : (
              <Lozenge appearance="moved">Awaiting the organiser</Lozenge>
            )}
          </div>
        ))}

        {!decided && (
          <div style={{ marginTop: 24 }}>
            <h3>Ask for clarification</h3>
            <p style={{ fontSize: 12, color: "#626F86", marginTop: 0 }}>
              A message is mandatory. Sending one moves the request to Awaiting Clarification.
            </p>
            <TextArea
              value={message}
              minimumRows={3}
              placeholder="What do you need the organiser to clarify?"
              onChange={(e) => setMessage((e.target as HTMLTextAreaElement).value)}
            />
            <div style={{ marginTop: 8 }}>
              <Button
                isDisabled={busy}
                onClick={async () => {
                  const ok = await run(() => requestClarification(session.token, event.id, message));
                  if (ok) setMessage("");
                }}
              >
                Send clarification request
              </Button>
            </div>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          <Refusal error={actionError} />
        </div>
      </div>

      <aside style={{ flex: 1, borderLeft: "1px solid #DFE1E6", paddingLeft: 24 }}>
        <h3 style={{ marginTop: 0 }}>Status</h3>
        <Lozenge appearance={STATUS_APPEARANCE[event.status]}>{STATUS_LABELS[event.status]}</Lozenge>

        {/* F5 — only the assigned coordinator, and only while the event is Approved or Planning. */}
        {event.assignedCoordinatorId === session.userId && (event.status === "APPROVED" || event.status === "PLANNING") && (
          <div style={{ marginTop: 12 }}>
            <ConfirmArrangementsAction eventId={event.id} token={session.token} onConfirmed={refresh} />
          </div>
        )}

        {/* U1 — only the assigned coordinator, and only while the event is in Safety Review. */}
        {event.assignedCoordinatorId === session.userId && event.status === "SAFETY_REVIEW" && (
          <div style={{ marginTop: 12 }}>
            <MarkConfirmedAction eventId={event.id} token={session.token} onConfirmed={refresh} />
          </div>
        )}

        {/* F3 — the assigned coordinator, until the event is Completed, Rejected or Cancelled. */}
        {canCancelEvent(event, session) && (
          <div style={{ marginTop: 12 }}>
            <CancelEventAction eventId={event.id} token={session.token} onCancelled={refresh} />
          </div>
        )}

        <p style={{ marginBottom: 0 }}>
          <Link to={`/venues/search?eventId=${event.id}`}>Find a venue</Link>
        </p>

        <dl style={{ fontSize: 13 }}>
          <Meta label="Organiser" value={nameOf(event.ownerId)!} />
          <Meta label="Submitted" value={formatInstant(event.submittedAt)} />
          <Meta label="Assigned coordinator" value={nameOf(event.assignedCoordinatorId) ?? "Awaiting assignment"} />
          <Meta label="Reviewer" value={nameOf(event.reviewingCoordinatorId) ?? "—"} />
        </dl>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 24 }}>
          <Button
            appearance="primary"
            isDisabled={busy || decided}
            onClick={() => run(async () => setEvent(await approveEvent(session.token, event.id)))}
          >
            Approve
          </Button>
          <Button
            appearance="warning"
            isDisabled={busy || decided}
            onClick={() => {
              setRejectError(null);
              setRejecting(true);
            }}
          >
            Reject
          </Button>
        </div>

        {/* E2 is retired (W9-FX-5): only the Lead reassigns, so a proposal is shown for the record
            and nobody can accept or decline it. */}
        {pendingProposal && (
          <div style={{ marginTop: 24 }}>
            <SectionMessage appearance="information" title="Pending reassignment">
              <p style={{ margin: 0 }}>
                Proposed to {nameOf(pendingProposal.nomineeCoordinatorId)} on{" "}
                {formatInstant(pendingProposal.proposedAt)}.
              </p>
            </SectionMessage>
          </div>
        )}
      </aside>

      {/* implementation.md §7.1: an irreversible action confirms, and the
          mandatory reason lives in that modal. */}
      <ModalTransition>
        {rejecting && (
          <Modal onClose={() => setRejecting(false)}>
            <ModalHeader>
              <ModalTitle appearance="warning">Reject this request?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                The organiser will see this reason, and a rejected request cannot be edited or
                resubmitted. A reason is required.
              </p>
              <div style={{ marginBottom: 12 }}>
                <Refusal error={rejectError} />
              </div>
              <TextArea
                value={reason}
                minimumRows={3}
                placeholder="Why can this request not be supported?"
                onChange={(e) => setReason((e.target as HTMLTextAreaElement).value)}
              />
              {rejectError instanceof ApiError && rejectError.fieldMessage("reason") && (
                <div style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>
                  {rejectError.fieldMessage("reason")}
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setRejecting(false)}>
                Cancel
              </Button>
              <Button
                appearance="warning"
                isDisabled={busy}
                onClick={async () => {
                  const ok = await run(async () => setEvent(await rejectEvent(session.token, event.id, reason)), setRejectError);
                  if (ok) {
                    setRejecting(false);
                    setReason("");
                  }
                }}
              >
                Reject request
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
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
      <dd style={{ margin: 0, wordBreak: "break-all" }}>{value}</dd>
    </>
  );
}
