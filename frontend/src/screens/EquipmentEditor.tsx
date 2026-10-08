import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import TextArea from "@atlaskit/textarea";
import Textfield from "@atlaskit/textfield";
import { ApiError } from "../api/client.js";
import {
  addEquipmentUnavailability,
  createEquipmentType,
  emptyEquipmentTypeForm,
  finiteNumber,
  fromEquipmentType,
  getEquipmentType,
  toEquipmentTypeInput,
  toInstant,
  updateEquipmentType,
  type EquipmentType,
  type EquipmentTypeForm,
} from "../api/equipment.js";
import { useSignedIn } from "../auth/SessionContext.js";
import { Refusal } from "../components/Refusal.js";

interface UnavailabilityForm {
  unitId: string;
  quantity: string;
  startsAt: string;
  endsAt: string;
  reason: string;
}

const emptyUnavailability = (): UnavailabilityForm => ({ unitId: "", quantity: "1", startsAt: "", endsAt: "", reason: "" });

/** P2 — type details, stock level and out-of-service periods in one maintenance flow. */
export function EquipmentEditor() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const equipmentTypeId = id && id !== "new" ? id : null;
  const [record, setRecord] = useState<EquipmentType | null>(null);
  const [form, setForm] = useState<EquipmentTypeForm>(emptyEquipmentTypeForm);
  const [unavailability, setUnavailability] = useState<UnavailabilityForm>(emptyUnavailability);
  const [error, setError] = useState<unknown>(null);
  const [unavailabilityError, setUnavailabilityError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>((location.state as { saved?: boolean } | null)?.saved ? "Equipment type saved." : null);
  const [loading, setLoading] = useState(Boolean(equipmentTypeId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!equipmentTypeId) {
      setForm(emptyEquipmentTypeForm());
      setLoading(false);
      return;
    }
    getEquipmentType(session.token, equipmentTypeId)
      .then((type) => {
        setRecord(type);
        setForm(fromEquipmentType(type));
      })
      .catch(setError)
      .finally(() => setLoading(false));
  }, [session.token, equipmentTypeId]);

  const fieldError = (source: unknown, name: string) => source instanceof ApiError ? source.fieldMessage(name) : undefined;
  const set = (name: keyof EquipmentTypeForm, value: string) => setForm((current) => ({ ...current, [name]: value }));
  const setUnavailable = (name: keyof UnavailabilityForm, value: string) => setUnavailability((current) => ({ ...current, [name]: value }));

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = toEquipmentTypeInput(form);
      const saved = equipmentTypeId
        ? await updateEquipmentType(session.token, equipmentTypeId, body)
        : await createEquipmentType(session.token, body);
      setRecord(saved);
      setForm(fromEquipmentType(saved));
      setNotice("Equipment type saved.");
      if (!equipmentTypeId) navigate(`/equipment/${saved.id}/edit`, { replace: true, state: { saved: true } });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  async function markUnavailable() {
    if (!equipmentTypeId) return;
    setSaving(true);
    setUnavailabilityError(null);
    setNotice(null);
    try {
      await addEquipmentUnavailability(session.token, equipmentTypeId, {
        unitId: form.kind === "SERIALIZED" ? unavailability.unitId || null : null,
        quantity: form.kind === "BULK" ? finiteNumber(unavailability.quantity) : null,
        startsAt: toInstant(unavailability.startsAt),
        endsAt: toInstant(unavailability.endsAt),
        reason: unavailability.reason,
      });
      const refreshed = await getEquipmentType(session.token, equipmentTypeId);
      setRecord(refreshed);
      setForm(fromEquipmentType(refreshed));
      setUnavailability(emptyUnavailability());
      setNotice("Unavailability recorded.");
    } catch (caught) {
      setUnavailabilityError(caught);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      <h2>{equipmentTypeId ? "Maintain equipment type" : "New equipment type"}</h2>
      {notice && <div style={{ marginBottom: 16 }}><SectionMessage appearance="success"><p style={{ margin: 0 }}>{notice}</p></SectionMessage></div>}
      <div style={{ marginBottom: 16 }}><Refusal error={error} /></div>

      <Field id="equipment-name" label="Name" error={fieldError(error, "name")}>
        <Textfield id="equipment-name" value={form.name} onChange={(event) => set("name", event.currentTarget.value)} />
      </Field>
      <Field id="equipment-description" label="Description" error={fieldError(error, "description")}>
        <TextArea id="equipment-description" value={form.description} onChange={(event) => set("description", event.currentTarget.value)} />
      </Field>
      <Field id="equipment-characteristics" label="Technical characteristics (name: value, one per line)" error={fieldError(error, "characteristics")}>
        <TextArea id="equipment-characteristics" minimumRows={3} value={form.characteristics} onChange={(event) => set("characteristics", event.currentTarget.value)} />
      </Field>
      <Field id="equipment-kind" label="Tracking method" error={fieldError(error, "kind")}>
        <select id="equipment-kind" disabled={Boolean(equipmentTypeId)} value={form.kind} onChange={(event) => {
          const kind = event.currentTarget.value as EquipmentTypeForm["kind"];
          setForm((current) => ({ ...current, kind }));
        }}>
          <option value="BULK">Bulk quantity</option>
          <option value="SERIALIZED">Individual units</option>
        </select>
      </Field>
      <Field id="equipment-total" label="Total quantity held" error={fieldError(error, "totalQuantity")}>
        <Textfield
          id="equipment-total"
          inputMode="numeric"
          isDisabled={form.kind === "SERIALIZED"}
          value={form.totalQuantity}
          onChange={(event) => set("totalQuantity", event.currentTarget.value)}
        />
      </Field>
      {form.kind === "SERIALIZED" && (
        <Field id="equipment-units" label="Unit labels (one per line)" error={fieldError(error, "unitLabels")}>
          <TextArea
            id="equipment-units"
            minimumRows={4}
            value={form.unitLabels}
            onChange={(event) => set("unitLabels", event.currentTarget.value)}
          />
        </Field>
      )}
      {form.kind === "SERIALIZED" && <p style={{ color: "#626F86", fontSize: 12 }}>Total held is derived from these individually tracked units.</p>}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button appearance="primary" isDisabled={saving} onClick={() => void save()}>Save equipment type</Button>
        <Button appearance="subtle" onClick={() => navigate("/equipment")}>Back to inventory</Button>
      </div>

      {equipmentTypeId && (
        <section aria-labelledby="unavailability-heading" style={{ borderTop: "1px solid #DFE1E6", marginTop: 28, paddingTop: 20 }}>
          <h3 id="unavailability-heading">Mark units unavailable</h3>
          <p>Record stock that is out of service for a stated period. This immediately affects availability checks.</p>
          <div style={{ marginBottom: 16 }}><Refusal error={unavailabilityError} /></div>
          {form.kind === "BULK" ? (
            <Field id="unavailable-quantity" label="Quantity" error={fieldError(unavailabilityError, "quantity")}>
              <Textfield id="unavailable-quantity" inputMode="numeric" value={unavailability.quantity} onChange={(event) => setUnavailable("quantity", event.currentTarget.value)} />
            </Field>
          ) : (
            <Field id="unavailable-unit" label="Unit" error={fieldError(unavailabilityError, "unitId")}>
              <select id="unavailable-unit" value={unavailability.unitId} onChange={(event) => setUnavailable("unitId", event.currentTarget.value)}>
                <option value="">Select a unit</option>
                {record?.units.map((unit) => <option key={unit.id} value={unit.id}>{unit.label}</option>)}
              </select>
            </Field>
          )}
          <Field id="unavailable-start" label="Unavailable from" error={fieldError(unavailabilityError, "startsAt")}>
            <input id="unavailable-start" type="datetime-local" value={unavailability.startsAt} onChange={(event) => setUnavailable("startsAt", event.currentTarget.value)} />
          </Field>
          <Field id="unavailable-end" label="Unavailable until" error={fieldError(unavailabilityError, "endsAt")}>
            <input id="unavailable-end" type="datetime-local" value={unavailability.endsAt} onChange={(event) => setUnavailable("endsAt", event.currentTarget.value)} />
          </Field>
          <Field id="unavailable-reason" label="Reason" error={fieldError(unavailabilityError, "reason")}>
            <TextArea id="unavailable-reason" value={unavailability.reason} onChange={(event) => setUnavailable("reason", event.currentTarget.value)} />
          </Field>
          <Button appearance="primary" isDisabled={saving} onClick={() => void markUnavailable()}>Mark unavailable</Button>

          <h4>Recorded unavailability</h4>
          {!record?.unavailability?.length ? <p>No out-of-service periods are recorded.</p> : (
            <ul>
              {record.unavailability.map((item) => (
                <li key={item.id}>{item.quantity} units · {formatDate(item.startsAt)} to {formatDate(item.endsAt)} · {item.reason} ({item.status.toLowerCase()})</li>
              ))}
            </ul>
          )}
        </section>
      )}

      {equipmentTypeId && record && (
        <section aria-labelledby="inventory-history-heading" style={{ borderTop: "1px solid #DFE1E6", marginTop: 28, paddingTop: 20 }}>
          <h3 id="inventory-history-heading">Inventory history</h3>
          {record.history.length === 0 ? <p>No inventory changes are recorded.</p> : (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead><tr><th style={cell}>When</th><th style={cell}>Change</th><th style={cell}>Quantity</th><th style={cell}>Acting user</th></tr></thead>
              <tbody>{record.history.map((entry) => (
                <tr key={entry.id}>
                  <td style={cell}>{formatDate(entry.occurredAt)}</td>
                  <td style={cell}>{historyLabel(entry.action)}</td>
                  <td style={cell}>{entry.previousQuantity} → {entry.newQuantity}</td>
                  <td style={cell}>{entry.actorUserId}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </section>
      )}
    </div>
  );
}

const cell = { textAlign: "left" as const, padding: "6px 12px 6px 0", borderBottom: "1px solid #DFE1E6" };

function historyLabel(action: string) {
  return action === "TYPE_CREATED" ? "Type created" : action === "TYPE_UPDATED" ? "Inventory updated" : "Unavailability recorded";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-SG", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return <div style={{ marginBottom: 12 }}>
    <label htmlFor={id} style={{ display: "block", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{label}</label>
    {children}
    {error && <div style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>{error}</div>}
  </div>;
}
