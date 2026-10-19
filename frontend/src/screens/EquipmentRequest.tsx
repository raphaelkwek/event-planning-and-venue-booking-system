import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import DynamicTable from "@atlaskit/dynamic-table";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import { useSignedIn } from "../auth/SessionContext.js";
import { useUserNames } from "../shared/useUserNames.js";
import { listEquipmentTypes } from "../api/equipmentAvailability.js";
import {
  EDITABLE_LINE_STATUSES,
  listRequestLines,
  removeRequestLine,
  saveRequestLines,
  updateRequestLine,
  type RequestEvent,
  type RequestLine,
} from "../api/equipmentRequests.js";
import { formatInstant, LINE_STATUS_APPEARANCE, LINE_STATUS_LABELS } from "../shared/status.js";
import { Refusal } from "../components/Refusal.js";
import {
  draftToInput,
  EquipmentLineFields,
  toInputValue,
  type LineDraft,
  type TypeOption,
} from "../components/EquipmentLineFields.js";

let draftCounter = 0;

/** A blank line whose times are the event's, which the coordinator may then change (O1). */
function newDraft(event: RequestEvent | null): LineDraft {
  draftCounter += 1;
  return {
    key: `draft-${draftCounter}`,
    equipmentTypeId: "",
    quantity: "",
    notes: "",
    requiredFrom: toInputValue(event?.proposedStartAt ?? null),
    requiredTo: toInputValue(event?.proposedEndAt ?? null),
  };
}

function draftOf(line: RequestLine): LineDraft {
  return {
    key: line.id,
    equipmentTypeId: line.equipmentTypeId,
    quantity: String(line.quantity),
    notes: line.notes,
    requiredFrom: toInputValue(line.requiredFrom),
    requiredTo: toInputValue(line.requiredTo),
  };
}

/**
 * O1 — the assigned coordinator records the equipment an event requires, edits a line while it is
 * Submitted or Under Review, and removes it. Other coordinators see the request but cannot change
 * it. The server enforces all of this; this screen only reflects it.
 */
export function EquipmentRequest() {
  const session = useSignedIn();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<RequestEvent | null>(null);
  const [lines, setLines] = useState<RequestLine[]>([]);
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [drafts, setDrafts] = useState<LineDraft[]>([]);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState<LineDraft | null>(null);
  const [editError, setEditError] = useState<unknown>(null);
  const [removing, setRemoving] = useState<RequestLine | null>(null);
  const [removeError, setRemoveError] = useState<unknown>(null);

  const nameOf = useUserNames(session.token, [event?.assignedCoordinatorId, ...lines.map((line) => line.requestedBy), ...lines.map((line) => line.reservation?.reservedBy)]);
  const isAssigned = event?.assignedCoordinatorId === session.userId;

  const load = useCallback(async () => {
    if (!eventId) return;
    setLoadError(null);
    try {
      // The event comes with the lines, from a read that changes nothing; opening it for review would claim it (D1).
      const [page, catalogue] = await Promise.all([listRequestLines(session.token, { eventId }), listEquipmentTypes(session.token)]);
      const opened = page.event ?? null;
      setEvent(opened);
      setLines(page.items);
      setTypes(catalogue.items.map((item) => ({ id: item.id, name: item.name })));
      setDrafts((current) => (current.length > 0 ? current : [newDraft(opened)]));
    } catch (caught) {
      setLoadError(caught);
    }
  }, [eventId, session.token]);

  useEffect(() => {
    void load();
  }, [load]);

  function changeDraft(key: string, changes: Partial<LineDraft>) {
    setSaved(null);
    setDrafts((current) => current.map((draft) => (draft.key === key ? { ...draft, ...changes } : draft)));
  }

  async function saveRequest() {
    if (!eventId) return;
    setBusy(true);
    setSaveError(null);
    setSaved(null);
    try {
      const result = await saveRequestLines(session.token, eventId, drafts.map(draftToInput));
      setSaved(result.items.length);
      setDrafts([newDraft(event)]);
      await load();
    } catch (caught) {
      // A rejected save changes nothing, so what was typed stays on screen to be corrected.
      setSaveError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setBusy(true);
    setEditError(null);
    try {
      await updateRequestLine(session.token, editing.key, draftToInput(editing));
      setEditing(null);
      await load();
    } catch (caught) {
      setEditError(caught);
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemoval() {
    if (!removing) return;
    setBusy(true);
    setRemoveError(null);
    try {
      await removeRequestLine(session.token, removing.id);
      setRemoving(null);
      await load();
    } catch (caught) {
      setRemoveError(caught);
    } finally {
      setBusy(false);
    }
  }

  if (loadError) return <Refusal error={loadError} />;
  if (!event) return <p>Loading the equipment request…</p>;

  const rows = lines.map((line) => ({
    key: line.id,
    cells: [
      { key: "type", content: line.equipmentTypeName },
      { key: "quantity", content: String(line.quantity) },
      { key: "notes", content: line.notes || "—" },
      { key: "from", content: formatInstant(line.requiredFrom) },
      { key: "to", content: formatInstant(line.requiredTo) },
      {
        key: "status",
        content: (
          <div>
            <Lozenge appearance={LINE_STATUS_APPEARANCE[line.status]}>{LINE_STATUS_LABELS[line.status]}</Lozenge>
            {line.status === "UNAVAILABLE" && <div style={{ fontSize: 12 }}>Reason: {line.unavailableReason}</div>}
            {line.status === "SUBSTITUTED" && (
              <div style={{ fontSize: 12 }}>
                Instead: {line.substituteEquipmentTypeName} × {line.substituteQuantity}
              </div>
            )}
            {line.reservation && (
              <div style={{ fontSize: 12 }}>
                Reserved {line.reservation.reservedQuantity} of {line.reservation.requestedQuantity}
                {line.reservation.equipmentTypeId !== line.equipmentTypeId && ` ${line.reservation.equipmentTypeName}`}
                <div style={{ color: "#626F86" }}>
                  {nameOf(line.reservation.reservedBy)} · {formatInstant(line.reservation.reservedAt)}
                </div>
              </div>
            )}
          </div>
        ),
      },
      { key: "by", content: `${nameOf(line.requestedBy)} · ${formatInstant(line.requestedAt)}` },
      {
        key: "actions",
        content: !isAssigned ? null : EDITABLE_LINE_STATUSES.includes(line.status) || line.status === "RESERVED" ? (
          <div style={{ display: "flex", gap: 8 }}>
            {/* Q2: a Reserved line cannot be edited, but the coordinator may remove it, which releases it. */}
            {line.status !== "RESERVED" && (
              <Button
                onClick={() => {
                  setEditError(null);
                  setEditing(draftOf(line));
                }}
              >
                Edit
              </Button>
            )}
            <Button
              onClick={() => {
                setRemoveError(null);
                setRemoving(line);
              }}
            >
              Remove
            </Button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: "#626F86" }}>Cannot be changed here</span>
        ),
      },
    ],
  }));

  return (
    <div style={{ maxWidth: 1000 }}>
      <p style={{ marginBottom: 0 }}>
        <Link to={`/review/${event.id}`}>← Back to the event</Link>
      </p>
      <h2 style={{ marginBottom: 4 }}>Equipment request</h2>
      <p style={{ marginTop: 0, color: "#626F86" }}>
        {event.reference} · {event.name} · {formatInstant(event.proposedStartAt)} to {formatInstant(event.proposedEndAt)}
      </p>

      {!isAssigned && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="information" title="You are not this event's coordinator">
            <p style={{ margin: 0 }}>
              Only {event.assignedCoordinatorId ? nameOf(event.assignedCoordinatorId) : "the assigned coordinator"} can record or
              change its equipment lines.
            </p>
          </SectionMessage>
        </div>
      )}

      <h3>Requested equipment</h3>
      <DynamicTable
        emptyView={<p>No equipment has been requested for this event yet.</p>}
        head={{
          cells: [
            { key: "type", content: "Equipment" },
            { key: "quantity", content: "Quantity" },
            { key: "notes", content: "Notes" },
            { key: "from", content: "Required from" },
            { key: "to", content: "Required to" },
            { key: "status", content: "Status" },
            { key: "by", content: "Recorded by" },
            { key: "actions", content: "" },
          ],
        }}
        rows={rows}
      />

      {editing && isAssigned && (
        <div style={{ marginTop: 24 }}>
          <h3>Edit line</h3>
          <Refusal error={editError} />
          <EquipmentLineFields
            draft={editing}
            types={types}
            idPrefix="edit"
            errorPrefix=""
            error={editError}
            onChange={(changes) => setEditing((current) => (current ? { ...current, ...changes } : current))}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <Button appearance="primary" isDisabled={busy} onClick={() => void saveEdit()}>
              Save changes
            </Button>
            <Button appearance="subtle" onClick={() => setEditing(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isAssigned && (
        <div style={{ marginTop: 32 }}>
          <h3>Add equipment</h3>
          <p style={{ fontSize: 12, color: "#626F86", marginTop: 0 }}>
            Each line starts with the event's dates and times; change them if the equipment is needed at other times. The
            request is saved whole: if any line is refused, none is saved.
          </p>
          {saved !== null && (
            <div style={{ marginBottom: 12 }}>
              <SectionMessage appearance="success" title={saved === 1 ? "1 line saved" : `${saved} lines saved`}>
                <p style={{ margin: 0 }}>Each line is Submitted and visible to Technical Support Staff.</p>
              </SectionMessage>
            </div>
          )}
          <Refusal error={saveError} />
          {drafts.map((draft, index) => (
            <div key={draft.key}>
              <EquipmentLineFields
                draft={draft}
                types={types}
                idPrefix={draft.key}
                errorPrefix={`lines.${index}.`}
                error={saveError}
                onChange={(changes) => changeDraft(draft.key, changes)}
              />
              {drafts.length > 1 && (
                <div style={{ marginBottom: 12 }}>
                  <Button
                    appearance="subtle"
                    onClick={() => setDrafts((current) => current.filter((entry) => entry.key !== draft.key))}
                  >
                    Discard line {index + 1}
                  </Button>
                </div>
              )}
            </div>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={() => setDrafts((current) => [...current, newDraft(event)])}>Add another line</Button>
            <Button appearance="primary" isDisabled={busy} onClick={() => void saveRequest()}>
              Save request
            </Button>
          </div>
        </div>
      )}

      {/* implementation.md §7.1: removal confirms, restating what will happen. */}
      <ModalTransition>
        {removing && (
          <Modal onClose={() => setRemoving(null)}>
            <ModalHeader>
              <ModalTitle>Remove this line?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                {removing.equipmentTypeName} × {removing.quantity} will be marked Removed and no longer listed. Who removed it and when
                is recorded.
                {removing.status === "RESERVED" && " Its reserved equipment will be released."}
              </p>
              <Refusal error={removeError} />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={() => setRemoving(null)}>
                Cancel
              </Button>
              <Button appearance="danger" isDisabled={busy} onClick={() => void confirmRemoval()}>
                Remove line
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </div>
  );
}
