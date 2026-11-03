import { useState, type FormEvent } from "react";
import Button from "@atlaskit/button/new";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { addAttendee } from "../api/registration.js";
import { Refusal } from "./Refusal.js";

/**
 * R7 — the owning organiser or the assigned coordinator adds an attendee by
 * the email of their account, with an optional reason. Before anything is
 * saved, a dialog shows the capacity and the number of attendees the addition
 * makes (D-01); above capacity it says so and asks to add over capacity. If the
 * last seat goes between showing and saving, the server refuses the unconfirmed
 * addition and the dialog shows its figures instead.
 */

const MAX_REASON = 500;
const attendees = (n: number) => (n === 1 ? "1 attendee" : `${n} attendees`);

interface Preview {
  capacity: number;
  totalAfter: number;
}

export function AddAttendee({ eventId, capacity, registered, onAdded }: { eventId: string; capacity: number; registered: number; onAdded: () => Promise<void> }) {
  const session = useSignedIn();
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const over = preview !== null && preview.totalAfter > preview.capacity;

  function onReview(e: FormEvent) {
    e.preventDefault();
    setAdded(null);
    setRefusal(null);
    setPreview({ capacity, totalAfter: registered + 1 });
  }

  function close() {
    setPreview(null);
    setRefusal(null);
  }

  async function onConfirm() {
    if (!preview) return;
    setBusy(true);
    setRefusal(null);
    try {
      const done = await addAttendee(session.token, eventId, { attendeeEmail: email.trim(), reason: reason.trim() || null, confirmOverCapacity: over });
      setAdded(`${done.attendee.name ?? done.attendee.email ?? email} was added: registration ${done.reference}.`);
      setEmail("");
      setReason("");
      setPreview(null);
      await onAdded();
    } catch (error) {
      const details = error instanceof ApiError ? error.envelope.details : undefined;
      if (error instanceof ApiError && error.envelope.code === "REGISTRATION_OVER_CAPACITY_UNCONFIRMED" && details) {
        // The last seat went since the list was loaded: show the server's figures and ask again.
        setPreview({ capacity: Number(details.capacity), totalAfter: Number(details.totalAfter) });
      } else {
        setRefusal(error);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="add-heading" style={{ marginTop: 32, maxWidth: 560 }}>
      <h2 id="add-heading">Add an attendee</h2>
      <p style={{ margin: "0 0 12px", color: "#626F86" }}>
        Add someone who must attend, even when the event is full or registration has closed. They need an attendee account, and are told they were added.
      </p>
      <form onSubmit={onReview}>
        <label htmlFor="add-email" style={{ display: "block", marginBottom: 4 }}>
          Attendee's email
        </label>
        <input id="add-email" type="email" required value={email} onChange={(e) => setEmail(e.currentTarget.value)} style={{ width: "100%", padding: 6 }} />
        <label htmlFor="add-reason" style={{ display: "block", margin: "12px 0 4px" }}>
          Reason (optional)
        </label>
        <textarea
          id="add-reason"
          maxLength={MAX_REASON}
          rows={2}
          value={reason}
          onChange={(e) => setReason(e.currentTarget.value)}
          style={{ width: "100%", padding: 6 }}
        />
        <div style={{ marginTop: 12 }}>
          <Button appearance="primary" type="submit">
            Add attendee
          </Button>
        </div>
      </form>
      {added && (
        <SectionMessage appearance="success" title="Attendee added">
          <p>{added}</p>
        </SectionMessage>
      )}

      <ModalTransition>
        {preview && (
          <Modal onClose={close} width="small">
            <ModalHeader>
              <ModalTitle>Add {email.trim()}?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p style={{ margin: 0 }}>Capacity {preview.capacity}</p>
              <p style={{ margin: "4px 0 12px" }}>With this addition: {attendees(preview.totalAfter)}</p>
              {over && (
                <SectionMessage appearance="warning" title="This takes the event over capacity">
                  <p>
                    The event holds {preview.capacity}, and this makes {preview.totalAfter}. It's your decision: the addition will be recorded as over capacity,
                    and places remaining stays at zero until enough attendees withdraw.
                  </p>
                </SectionMessage>
              )}
              <Refusal error={refusal} />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={close}>
                Cancel
              </Button>
              <Button appearance={over ? "warning" : "primary"} onClick={() => void onConfirm()} isDisabled={busy}>
                {over ? "Add over capacity" : "Add attendee"}
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </section>
  );
}
