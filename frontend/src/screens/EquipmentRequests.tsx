import { useCallback, useEffect, useState } from "react";
import Button from "@atlaskit/button/new";
import DynamicTable from "@atlaskit/dynamic-table";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import Textfield from "@atlaskit/textfield";
import { useSignedIn } from "../auth/SessionContext.js";
import { listEquipmentTypes } from "../api/equipmentAvailability.js";
import {
  changeLineStatus,
  listRequestLines,
  reserveLine,
  type LineStatus,
  type RequestLine,
  type StaffLineStatus,
  type StatusChangeInput,
} from "../api/equipmentRequests.js";
import { finiteNumber } from "../api/equipment.js";
import { formatInstant, LINE_STATUS_APPEARANCE, LINE_STATUS_LABELS } from "../shared/status.js";
import { useUserNames } from "../shared/useUserNames.js";
import { fieldMessage, type TypeOption } from "../components/EquipmentLineFields.js";
import { Refusal } from "../components/Refusal.js";

/** O2: the four statuses Technical Support sets. Reserved is Q1's. */
const STAFF_STATUSES: StaffLineStatus[] = ["UNDER_REVIEW", "CONFIRMED", "UNAVAILABLE", "SUBSTITUTED"];
const FILTERS: (LineStatus | "")[] = ["", "SUBMITTED", "UNDER_REVIEW", "CONFIRMED", "UNAVAILABLE", "SUBSTITUTED", "RESERVED"];

interface Update {
  status: StaffLineStatus;
  reason: string;
  substituteEquipmentTypeId: string;
  substituteQuantity: string;
}

const blankUpdate: Update = { status: "UNDER_REVIEW", reason: "", substituteEquipmentTypeId: "", substituteQuantity: "" };

function toChange(update: Update): StatusChangeInput {
  if (update.status === "UNAVAILABLE") return { status: update.status, reason: update.reason };
  if (update.status === "SUBSTITUTED") {
    return {
      status: update.status,
      substituteEquipmentTypeId: update.substituteEquipmentTypeId,
      substituteQuantity: finiteNumber(update.substituteQuantity),
    };
  }
  return { status: update.status };
}

/**
 * O2 — Technical Support see every equipment line, filter by status, and update a line as
 * arrangements are made. The assigned coordinator is notified of each change by the server.
 */
export function EquipmentRequests() {
  const session = useSignedIn();
  const [lines, setLines] = useState<RequestLine[]>([]);
  const [types, setTypes] = useState<TypeOption[]>([]);
  const [filter, setFilter] = useState<LineStatus | "">("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [updating, setUpdating] = useState<RequestLine | null>(null);
  const [update, setUpdate] = useState<Update>(blankUpdate);
  const [updateError, setUpdateError] = useState<unknown>(null);
  const [updated, setUpdated] = useState<string | null>(null);
  const [reserving, setReserving] = useState<RequestLine | null>(null);
  const [reserveQuantity, setReserveQuantity] = useState("");
  const [partial, setPartial] = useState(false);
  const [reserveError, setReserveError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const nameOf = useUserNames(session.token, lines.map((line) => line.statusChangedBy));

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [page, catalogue] = await Promise.all([
        listRequestLines(session.token, filter ? { status: filter } : {}),
        listEquipmentTypes(session.token),
      ]);
      setLines(page.items);
      setTypes(catalogue.items.map((item) => ({ id: item.id, name: item.name })));
    } catch (caught) {
      setLoadError(caught);
    } finally {
      setLoading(false);
    }
  }, [session.token, filter]);

  useEffect(() => {
    void load();
  }, [load]);

  function open(line: RequestLine) {
    setUpdated(null);
    setUpdateError(null);
    setReserving(null);
    setUpdating(line);
    setUpdate(blankUpdate);
  }

  async function save() {
    if (!updating) return;
    setBusy(true);
    setUpdateError(null);
    try {
      const changed = await changeLineStatus(session.token, updating.id, toChange(update));
      setUpdated(`${changed.equipmentTypeName} for ${changed.eventReference} is now ${LINE_STATUS_LABELS[changed.status]}.`);
      setUpdating(null);
      await load();
    } catch (caught) {
      // The line keeps its status; the refusal says why.
      setUpdateError(caught);
    } finally {
      setBusy(false);
    }
  }

  /** Q1: a Substituted line reserves the substitute, so its quantity is what is asked for. */
  const requestedFor = (line: RequestLine) => (line.status === "SUBSTITUTED" ? line.substituteQuantity ?? line.quantity : line.quantity);

  function openReserve(line: RequestLine) {
    setUpdated(null);
    setUpdating(null);
    setReserveError(null);
    setPartial(false);
    setReserveQuantity(String(requestedFor(line)));
    setReserving(line);
  }

  async function reserve() {
    if (!reserving) return;
    setBusy(true);
    setReserveError(null);
    try {
      const done = await reserveLine(session.token, reserving.id, { quantity: finiteNumber(reserveQuantity), partial });
      setUpdated(`Reserved ${done.reservation.reservedQuantity} of ${done.reservation.requestedQuantity} for ${done.line.eventReference}.`);
      setReserving(null);
      await load();
    } catch (caught) {
      // Nothing was reserved; the refusal says why.
      setReserveError(caught);
    } finally {
      setBusy(false);
    }
  }

  const problem = (field: string) => fieldMessage(updateError, field);

  return (
    <div style={{ maxWidth: 1100 }}>
      <h2>Equipment requests</h2>
      <p style={{ marginTop: 0 }}>
        The equipment each event needs, as recorded by its coordinator. Update a line as you arrange it; the coordinator is
        notified of the new status.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label htmlFor="status-filter">Show</label>{" "}
        <select id="status-filter" value={filter} onChange={(event) => setFilter(event.target.value as LineStatus | "")} style={{ padding: 8 }}>
          {FILTERS.map((status) => (
            <option key={status} value={status}>
              {status ? LINE_STATUS_LABELS[status] : "All active lines"}
            </option>
          ))}
        </select>
      </div>

      <Refusal error={loadError} />
      {updated && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="success" title="Status updated">
            <p style={{ margin: 0 }}>{updated}</p>
          </SectionMessage>
        </div>
      )}

      <DynamicTable
        isLoading={loading}
        emptyView={<p>No equipment lines match.</p>}
        head={{
          cells: [
            { key: "event", content: "Event" },
            { key: "type", content: "Equipment" },
            { key: "quantity", content: "Quantity" },
            { key: "needed", content: "Needed" },
            { key: "notes", content: "Notes" },
            { key: "status", content: "Status" },
            { key: "actions", content: "" },
          ],
        }}
        rows={lines.map((line) => ({
          key: line.id,
          cells: [
            { key: "event", content: line.eventReference },
            { key: "type", content: line.equipmentTypeName },
            { key: "quantity", content: String(line.quantity) },
            { key: "needed", content: `${formatInstant(line.requiredFrom)} to ${formatInstant(line.requiredTo)}` },
            { key: "notes", content: line.notes || "—" },
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
                    </div>
                  )}
                  {line.statusChangedBy && (
                    <div style={{ fontSize: 12, color: "#626F86" }}>
                      {nameOf(line.statusChangedBy)} · {formatInstant(line.statusChangedAt)}
                    </div>
                  )}
                </div>
              ),
            },
            {
              key: "actions",
              content:
                line.status === "RESERVED" ? (
                  <span style={{ fontSize: 12, color: "#626F86" }}>Reserved</span>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Button onClick={() => open(line)}>Update</Button>
                    {(line.status === "CONFIRMED" || line.status === "SUBSTITUTED") && (
                      <Button onClick={() => openReserve(line)}>Reserve</Button>
                    )}
                  </div>
                ),
            },
          ],
        }))}
      />

      {updating && (
        <div style={{ marginTop: 24, maxWidth: 640 }}>
          <h3>
            Update {updating.equipmentTypeName} × {updating.quantity} for {updating.eventReference}
          </h3>
          <Refusal error={updateError} />
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="new-status">New status</label>
            <select
              id="new-status"
              value={update.status}
              onChange={(event) => setUpdate({ ...update, status: event.target.value as StaffLineStatus })}
              style={{ display: "block", width: "100%", padding: 8 }}
            >
              {STAFF_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {LINE_STATUS_LABELS[status]}
                </option>
              ))}
            </select>
          </div>
          {update.status === "UNAVAILABLE" && (
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="reason">Reason</label>
              <Textfield
                id="reason"
                value={update.reason}
                isInvalid={Boolean(problem("reason"))}
                onChange={(event) => setUpdate({ ...update, reason: event.currentTarget.value })}
              />
              {problem("reason") && <p style={{ color: "#AE2A19", margin: "4px 0 0" }}>{problem("reason")}</p>}
            </div>
          )}
          {update.status === "SUBSTITUTED" && (
            <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 2, minWidth: 200 }}>
                <label htmlFor="substitute-type">Substitute equipment</label>
                <select
                  id="substitute-type"
                  value={update.substituteEquipmentTypeId}
                  onChange={(event) => setUpdate({ ...update, substituteEquipmentTypeId: event.target.value })}
                  style={{ display: "block", width: "100%", padding: 8 }}
                >
                  <option value="">Select the substitute</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
                {problem("substituteEquipmentTypeId") && (
                  <p style={{ color: "#AE2A19", margin: "4px 0 0" }}>{problem("substituteEquipmentTypeId")}</p>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <label htmlFor="substitute-quantity">Substitute quantity</label>
                <Textfield
                  id="substitute-quantity"
                  type="number"
                  min={1}
                  step={1}
                  value={update.substituteQuantity}
                  isInvalid={Boolean(problem("substituteQuantity"))}
                  aria-invalid={Boolean(problem("substituteQuantity"))}
                  onChange={(event) => setUpdate({ ...update, substituteQuantity: event.currentTarget.value })}
                />
                {problem("substituteQuantity") && (
                  <p style={{ color: "#AE2A19", margin: "4px 0 0" }}>{problem("substituteQuantity")}</p>
                )}
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button appearance="primary" isDisabled={busy} onClick={() => void save()}>
              Save status
            </Button>
            <Button appearance="subtle" onClick={() => setUpdating(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {reserving && (
        <div style={{ marginTop: 24, maxWidth: 640 }}>
          <h3>
            Reserve {reserving.status === "SUBSTITUTED" ? reserving.substituteEquipmentTypeName : reserving.equipmentTypeName} ×{" "}
            {requestedFor(reserving)} for {reserving.eventReference}
          </h3>
          <Refusal error={reserveError} />
          <div style={{ marginBottom: 12, maxWidth: 200 }}>
            <label htmlFor="reserve-quantity">Quantity to reserve</label>
            <Textfield
              id="reserve-quantity"
              type="number"
              min={1}
              step={1}
              value={reserveQuantity}
              isInvalid={Boolean(fieldMessage(reserveError, "quantity"))}
              onChange={(event) => setReserveQuantity(event.currentTarget.value)}
            />
            {fieldMessage(reserveError, "quantity") && (
              <p style={{ color: "#AE2A19", margin: "4px 0 0" }}>{fieldMessage(reserveError, "quantity")}</p>
            )}
          </div>
          {Number(reserveQuantity) < requestedFor(reserving) && (
            <div style={{ marginBottom: 12 }}>
              <label>
                <input type="checkbox" checked={partial} onChange={(event) => setPartial(event.currentTarget.checked)} />{" "}
                Reserve fewer than requested
              </label>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <Button appearance="primary" isDisabled={busy} onClick={() => void reserve()}>
              Reserve equipment
            </Button>
            <Button appearance="subtle" onClick={() => setReserving(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
