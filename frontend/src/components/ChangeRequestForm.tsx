import { useState, type FormEvent, type ReactNode } from "react";
import Button from "@atlaskit/button/new";
import { Checkbox } from "@atlaskit/checkbox";
import TextArea from "@atlaskit/textarea";
import Textfield from "@atlaskit/textfield";
import { ApiError } from "../api/client.js";
import { requestChange, type ProposedChanges } from "../api/changeRequests.js";
import { toInstant } from "../api/equipment.js";
import type { EventRecord } from "../api/types.js";
import { toInputValue } from "./EquipmentLineFields.js";
import { Refusal } from "./Refusal.js";

/**
 * S1 — the organiser's change request: start, end, expected attendance and
 * whether equipment is required. Only what differs from the event is sent.
 * The venue and equipment requirement editors live inside the request form
 * and are not reusable components, so they are not offered here; the API
 * accepts them.
 */
interface Form {
  start: string;
  end: string;
  attendance: string;
  equipmentRequired: boolean;
  reason: string;
}

const formOf = (event: EventRecord): Form => ({
  start: toInputValue(event.proposedStartAt),
  end: toInputValue(event.proposedEndAt),
  attendance: event.expectedAttendance === null ? "" : String(event.expectedAttendance),
  equipmentRequired: event.equipmentRequired ?? false,
  reason: "",
});

function changesFrom(event: EventRecord, form: Form): ProposedChanges {
  const original = formOf(event);
  const changes: ProposedChanges = {};
  if (form.start !== original.start) changes.proposedStartAt = toInstant(form.start);
  if (form.end !== original.end) changes.proposedEndAt = toInstant(form.end);
  if (form.attendance !== original.attendance) changes.expectedAttendance = Number(form.attendance);
  if (form.equipmentRequired !== original.equipmentRequired) changes.equipmentRequired = form.equipmentRequired;
  return changes;
}

export function ChangeRequestForm({
  event,
  token,
  onSent,
  onCancel,
}: {
  event: EventRecord;
  token: string;
  onSent: () => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Form>(() => formOf(event));
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldMessage(field) : undefined);
  // A refusal whose every field is shown beside its control needs no summary above.
  const SHOWN = ["reason", "changes.proposedStartAt", "changes.proposedEndAt", "changes.expectedAttendance", "changes.equipmentRequired"];
  const allShown = error instanceof ApiError && (error.envelope.fields ?? []).length > 0 && (error.envelope.fields ?? []).every((f) => SHOWN.includes(f.field));

  async function send(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    const changes = changesFrom(event, form);
    if (Object.keys(changes).length === 0) {
      setNotice("You haven't changed anything.");
      return;
    }
    setBusy(true);
    try {
      await requestChange(token, event.id, { reason: form.reason, changes });
      onSent();
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={send} aria-label="Request a change" style={{ border: "1px solid #DFE1E6", borderRadius: 4, padding: 16, marginBottom: 16 }}>
      <h3 style={{ marginTop: 0 }}>Request a change</h3>
      {error && !allShown ? <Refusal error={error} /> : null}
      {notice && (
        <p role="status" style={{ color: "#626F86" }}>
          {notice}
        </p>
      )}
      <Field id="change-start" label="Start" error={fieldError("changes.proposedStartAt")}>
        <Textfield id="change-start" type="datetime-local" value={form.start} onChange={(e) => set("start", e.currentTarget.value)} />
      </Field>
      <Field id="change-end" label="End" error={fieldError("changes.proposedEndAt")}>
        <Textfield id="change-end" type="datetime-local" value={form.end} onChange={(e) => set("end", e.currentTarget.value)} />
      </Field>
      <Field id="change-attendance" label="Expected attendance" error={fieldError("changes.expectedAttendance")}>
        <Textfield id="change-attendance" type="number" value={form.attendance} onChange={(e) => set("attendance", e.currentTarget.value)} />
      </Field>
      <Field id="change-equipment" label="" error={fieldError("changes.equipmentRequired")}>
        <Checkbox
          label="Equipment is required"
          isChecked={form.equipmentRequired}
          onChange={(e) => set("equipmentRequired", e.currentTarget.checked)}
        />
      </Field>
      <Field id="change-reason" label="Reason" error={fieldError("reason")}>
        <TextArea id="change-reason" minimumRows={3} value={form.reason} onChange={(e) => set("reason", e.currentTarget.value)} />
      </Field>
      <div style={{ display: "flex", gap: 8 }}>
        <Button appearance="primary" type="submit" isDisabled={busy}>
          Send request
        </Button>
        <Button appearance="subtle" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      {label && (
        <label htmlFor={id} style={{ display: "block", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
          {label}
        </label>
      )}
      {children}
      {error && (
        <div role="alert" style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}
