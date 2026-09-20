import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import TextArea from "@atlaskit/textarea";
import Textfield from "@atlaskit/textfield";
import SectionMessage from "@atlaskit/section-message";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import {
  acceptReassignment,
  approveEvent,
  declineReassignment,
  listClarifications,
  listReassignmentProposals,
  openEvent,
  proposeReassignment,
  rejectEvent,
  requestClarification,
} from "../api/events.js";
import type { Clarification, EventRecord, ReassignmentProposal } from "../api/types.js";
import { ApiError } from "../api/client.js";
import { formatInstant, STATUS_APPEARANCE, STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";
import { EquipmentRequirementsView, VenueRequirementsView } from "../components/Requirements.js";

/**
 * D1, D2, D4, D5 — the coordinator's review screen.
 *
 * Simply opening this screen is what moves a Submitted request to Under Review
 * and records the reviewer (D1), so the read is the action.
 */
export function ReviewDetail() {
  const session = useSignedIn();
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [proposals, setProposals] = useState<ReassignmentProposal[]>([]);
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

  const [proposing, setProposing] = useState(false);
  const [nomineeId, setNomineeId] = useState("");
  const [proposeError, setProposeError] = useState<unknown>(null);

  const pendingProposal = proposals.find((proposal) => proposal.status === "PENDING") ?? null;
  const nameOf = useUserNames(session.token, [
    event?.ownerId,
    event?.assignedCoordinatorId,
    event?.reviewingCoordinatorId,
    event?.decidedBy,
    pendingProposal?.nomineeCoordinatorId,
  ]);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setLoadError(null);
    try {
      setEvent(await openEvent(session.token, id));
      setClarifications((await listClarifications(session.token, id)).items);
      setProposals((await listReassignmentProposals(session.token, id)).items);
    } catch (caught) {
      setLoadError(caught);
    } finally {
      setLoading(false);
    }
  }, [id, session.token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function run(action: () => Promise<unknown>, onError: (error: unknown) => void = setActionError) {
    onError(null);
    setBusy(true);
    try {
      await action();
      await load();
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

  const decided = event.decidedAt !== null;
  const reviewedBySomeoneElse =
    event.reviewingCoordinatorId !== null && event.reviewingCoordinatorId !== session.userId;

  return (
    <div style={{ display: "flex", gap: 32, alignItems: "flex-start" }}>
      <div style={{ flex: 2 }}>
        <h2 style={{ marginBottom: 4 }}>{event.name}</h2>
        <p style={{ marginTop: 0, color: "#626F86" }}>{event.reference}</p>

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

        {decided && (
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

        <Detail label="Purpose" value={event.purpose} />
        <Detail label="Description" value={event.description} />
        <Detail label="Proposed start" value={formatInstant(event.proposedStartAt)} />
        <Detail label="Proposed end" value={formatInstant(event.proposedEndAt)} />
        <Detail
          label="Expected attendance"
          value={event.expectedAttendance === null ? null : String(event.expectedAttendance)}
        />
        <Detail label="Accessibility needs" value={event.accessibilityNeeds} />
        <VenueRequirementsView value={event.venueRequirements} />
        <EquipmentRequirementsView required={event.equipmentRequired} lines={event.equipmentRequirements} />
        <Detail label="Registration required" value={event.registrationRequired ? "Yes" : "No"} />

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
            onClick={() => run(() => approveEvent(session.token, event.id))}
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
          {/* E2 — a peer action to Approve/Reject: the active coordinator can
              hand the event off, as long as no proposal is already pending. */}
          {/* Not offered at all once a decision is recorded: reassignment is
              permitted only while the request is still open (E2-T7), so showing
              it disabled would promise something that can never happen. */}
          {!pendingProposal && !decided && event.assignedCoordinatorId === session.userId && (
            <Button
              isDisabled={busy}
              onClick={() => {
                setProposeError(null);
                setNomineeId("");
                setProposing(true);
              }}
            >
              Propose reassignment
            </Button>
          )}
        </div>

        {/* E2 — the pending state and the nominee's accept/decline, shown
            beneath the action buttons once a proposal exists. */}
        {pendingProposal && (
          <div style={{ marginTop: 24 }}>
            <SectionMessage appearance="information" title="Pending reassignment">
              <p style={{ margin: 0 }}>
                Proposed to {nameOf(pendingProposal.nomineeCoordinatorId)} on{" "}
                {formatInstant(pendingProposal.proposedAt)}.
              </p>
            </SectionMessage>
            {pendingProposal.nomineeCoordinatorId === session.userId && (
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <Button
                  appearance="primary"
                  isDisabled={busy}
                  onClick={() => run(() => acceptReassignment(session.token, event.id))}
                >
                  Accept
                </Button>
                <Button
                  appearance="subtle"
                  isDisabled={busy}
                  onClick={() => run(() => declineReassignment(session.token, event.id))}
                >
                  Decline
                </Button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* implementation.md §7.1: an irreversible action confirms, and the
          mandatory reason lives in that modal. */}
      <ModalTransition>
        {proposing && (
          <Modal onClose={() => setProposing(false)}>
            <ModalHeader>
              <ModalTitle>Propose reassignment</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                The nominee keeps no coordinator actions on this event until they accept. You
                remain the active coordinator until then.
              </p>
              <div style={{ marginBottom: 12 }}>
                <Refusal error={proposeError} />
              </div>
              <label style={{ fontSize: 12, fontWeight: 600 }}>Nominee's user id</label>
              <Textfield
                value={nomineeId}
                onChange={(e) => setNomineeId((e.target as HTMLInputElement).value)}
              />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setProposing(false)}>
                Cancel
              </Button>
              <Button
                appearance="primary"
                isDisabled={busy}
                onClick={async () => {
                  const ok = await run(
                    () => proposeReassignment(session.token, event.id, nomineeId.trim()),
                    setProposeError
                  );
                  if (ok) setProposing(false);
                }}
              >
                Send proposal
              </Button>
            </ModalFooter>
          </Modal>
        )}
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
                  const ok = await run(() => rejectEvent(session.token, event.id, reason), setRejectError);
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
