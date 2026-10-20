import { useState } from "react";
import Button from "@atlaskit/button/new";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { ApiError } from "../api/client.js";
import {
  confirmArrangements,
  type EquipmentOutstanding,
  type FlagOutstanding,
  type VenueOutstanding,
} from "../api/confirmations.js";
import { LINE_STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "./Refusal.js";

interface Outstanding {
  venue: VenueOutstanding[];
  equipment: EquipmentOutstanding[];
  flags: FlagOutstanding[];
}

/** The server's ARRANGEMENTS_NOT_READY lists what is outstanding under `details`. */
function outstandingOf(error: unknown): Outstanding | null {
  if (!(error instanceof ApiError) || error.envelope.code !== "ARRANGEMENTS_NOT_READY") return null;
  const details = (error.envelope.details ?? {}) as Partial<Outstanding>;
  return { venue: details.venue ?? [], equipment: details.equipment ?? [], flags: details.flags ?? [] };
}

function venueText(item: VenueOutstanding): string {
  if (item.kind === "NO_CONFIRMED_BOOKING") return "No venue booking is confirmed.";
  return item.kind === "HOLD"
    ? `${item.reference} at ${item.venueName} is only a tentative hold.`
    : `${item.reference} at ${item.venueName} is still pending.`;
}

function equipmentText(item: EquipmentOutstanding): string {
  if (item.kind === "NONE_REQUESTED") return "No equipment has been requested, and the event is not marked as needing none.";
  const line = `${item.equipmentTypeName} × ${item.quantity}`;
  return item.reservedQuantity !== null && item.requestedQuantity !== null && item.reservedQuantity < item.requestedQuantity
    ? `${line}: ${item.reservedQuantity} of ${item.requestedQuantity} reserved.`
    : `${line} is ${LINE_STATUS_LABELS[item.status]}.`;
}

const FLAG_LABELS: Record<FlagOutstanding["flag"], string> = {
  REQUIRES_RECONFIRMATION: "requires reconfirmation",
  UNSUITABLE: "flagged unsuitable",
  FLAGGED_FOR_REVIEW: "flagged for review",
};

/** A booking, hold or request by its reference and venue; an equipment line by its type and quantity. */
function flagSubject(flag: FlagOutstanding): string {
  return flag.arrangement === "EQUIPMENT_LINE" ? flag.name : `${flag.reference} at ${flag.name}`;
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <>
      <h4 style={{ marginBottom: 4 }}>{title}</h4>
      <ul style={{ marginTop: 0 }}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  );
}

/**
 * F5 — "Confirm arrangements" for the event's assigned coordinator while it is
 * Approved or Planning. The dialog restates what happens; a refusal stays in
 * the dialog (§7.1), naming each outstanding arrangement.
 */
export function ConfirmArrangementsAction({ eventId, token, onConfirmed }: { eventId: string; token: string; onConfirmed: () => void }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  function close() {
    setOpen(false);
    setError(null);
  }

  async function confirm() {
    setError(null);
    setBusy(true);
    try {
      await confirmArrangements(token, eventId);
      close();
      onConfirmed();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const outstanding = outstandingOf(error);

  return (
    <>
      <Button appearance="primary" onClick={() => setOpen(true)}>
        Confirm arrangements
      </Button>
      <ModalTransition>
        {open && (
          <Modal onClose={close}>
            <ModalHeader>
              <ModalTitle>Confirm the venue and equipment arrangements?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                The event moves to Safety Review, where the Safety Officer reviews it before it becomes Confirmed. Its organiser,
                the Venue Staff of each booked venue and the Technical Support Staff who reserved equipment are notified.
              </p>
              <Refusal error={error} />
              {outstanding && (
                <div aria-label="Outstanding arrangements">
                  <List title="Venue" items={outstanding.venue.map(venueText)} />
                  <List title="Equipment" items={outstanding.equipment.map(equipmentText)} />
                  <List
                    title="Outstanding flags"
                    items={outstanding.flags.map((flag) => `${flagSubject(flag)}: ${FLAG_LABELS[flag.flag]}.`)}
                  />
                </div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={close}>
                Cancel
              </Button>
              <Button appearance="primary" isDisabled={busy} onClick={() => void confirm()}>
                Confirm arrangements
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </>
  );
}
