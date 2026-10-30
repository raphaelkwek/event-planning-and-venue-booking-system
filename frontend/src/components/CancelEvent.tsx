import { useState } from "react";
import Button from "@atlaskit/button/new";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import SectionMessage from "@atlaskit/section-message";
import TextArea from "@atlaskit/textarea";
import { ApiError } from "../api/client.js";
import { cancelEvent } from "../api/cancellations.js";
import type { EventRecord, EventStatus } from "../api/types.js";
import { formatInstant } from "../shared/status.js";
import { Refusal } from "./Refusal.js";

/** F3 AC1 — the statuses an event can no longer be cancelled from. */
const FINAL: readonly EventStatus[] = ["COMPLETED", "REJECTED", "CANCELLED"];

/**
 * F3 — who is offered "Cancel event", and when: the owner or the assigned coordinator, until the event is
 * Completed, Rejected or Cancelled. The server applies the same rule whether or not the screen offered it.
 */
export function canCancelEvent(event: EventRecord, session: { userId: string; role: string }): boolean {
  if (FINAL.includes(event.status)) return false;
  if (session.role === "EVENT_ORGANISER") return session.userId === event.ownerId;
  if (session.role === "EVENT_COORDINATOR") return session.userId === event.assignedCoordinatorId;
  return false;
}

const EMPTY_REASON = "Give a reason for cancelling the event.";

/**
 * F3 — "Cancel event" opens a dialog that restates what happens and holds the mandatory reason
 * (implementation.md §5). A refusal stays in the dialog.
 */
export function CancelEventAction({ eventId, token, onCancelled }: { eventId: string; token: string; onCancelled: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setError(null);
    setReasonError(null);
  }

  async function confirm() {
    if (reason.trim().length === 0) return setReasonError(EMPTY_REASON);
    setReasonError(null);
    setError(null);
    setBusy(true);
    try {
      await cancelEvent(token, eventId, reason);
      close();
      setReason("");
      onCancelled();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const serverReason = error instanceof ApiError ? error.fieldMessage("reason") : undefined;

  return (
    <>
      <Button appearance="danger" onClick={() => setOpen(true)}>
        Cancel event
      </Button>
      <ModalTransition>
        {open && (
          <Modal onClose={close}>
            <ModalHeader>
              <ModalTitle appearance="danger">Cancel this event?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                The event becomes Cancelled and can't be edited or arranged any further. Its venue bookings and holds are
                released, its pending venue requests withdrawn and its equipment reservations released, so others can use
                them. A change request still pending is closed. Its organiser, its coordinator, the Venue Staff of each booked venue and the Technical Support Staff who
                reserved equipment are told, with your reason. This can't be undone.
              </p>
              <Refusal error={serverReason ? null : error} />
              <label htmlFor="cancel-event-reason" style={{ fontSize: 12, fontWeight: 600 }}>
                Reason
              </label>
              <TextArea
                id="cancel-event-reason"
                value={reason}
                minimumRows={3}
                onChange={(e) => setReason((e.target as HTMLTextAreaElement).value)}
              />
              {(reasonError ?? serverReason) && (
                <div style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>{reasonError ?? serverReason}</div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={close}>
                Keep the event
              </Button>
              <Button appearance="danger" isDisabled={busy} onClick={() => void confirm()}>
                Cancel event
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </>
  );
}

/** F3 AC4 — a cancelled event shows when it was cancelled, and why. */
export function CancelledNotice({ event }: { event: EventRecord }) {
  if (event.status !== "CANCELLED") return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <SectionMessage appearance="error" title="This event was cancelled">
        <p style={{ margin: 0 }}>{event.cancellationReason}</p>
        <p style={{ marginBottom: 0, fontSize: 12 }}>Cancelled {formatInstant(event.cancelledAt)}.</p>
      </SectionMessage>
    </div>
  );
}
