import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import TextArea from "@atlaskit/textarea";
import Textfield from "@atlaskit/textfield";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { openEvent, updateEventDetails, type DetailsChanges } from "../api/events.js";
import type { EventRecord } from "../api/types.js";
import { Refusal } from "../components/Refusal.js";
import { EquipmentRequirementsView, VenueRequirementsView } from "../components/Requirements.js";
import { formatInstant } from "../shared/status.js";

/**
 * G1 — the owning organiser or the assigned coordinator keeps an event's
 * descriptive details accurate during planning: purpose, description,
 * accessibility notes and contact details. The significant fields are shown
 * as text only; they change through a change request, because arrangements
 * depend on them. The save carries the version this screen loaded, so an edit
 * made since is never silently overwritten (G1-T11).
 */

type Form = { purpose: string; description: string; accessibilityNeeds: string; contactDetails: string };

const formOf = (event: EventRecord): Form => ({
  purpose: event.purpose ?? "",
  description: event.description ?? "",
  accessibilityNeeds: event.accessibilityNeeds ?? "",
  contactDetails: event.contactDetails ?? "",
});

/** Only what changed, trimmed; an emptied optional field becomes null. */
function changesFrom(event: EventRecord, form: Form): DetailsChanges {
  const changes: DetailsChanges = {};
  const purpose = form.purpose.trim();
  const description = form.description.trim();
  const accessibilityNeeds = form.accessibilityNeeds.trim() || null;
  const contactDetails = form.contactDetails.trim() || null;
  if (purpose !== (event.purpose ?? "")) changes.purpose = purpose;
  if (description !== (event.description ?? "")) changes.description = description;
  if (accessibilityNeeds !== event.accessibilityNeeds) changes.accessibilityNeeds = accessibilityNeeds;
  if (contactDetails !== event.contactDetails) changes.contactDetails = contactDetails;
  return changes;
}

export function EventDetailsEditor() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const back = session.role === "EVENT_COORDINATOR" ? `/review/${id}` : `/requests/${id}`;

  const load = useCallback(async () => {
    setLoadError(null);
    setSaveError(null);
    setNotice(null);
    try {
      const loaded = await openEvent(session.token, id!);
      setEvent(loaded);
      setForm(formOf(loaded));
    } catch (caught) {
      setLoadError(caught);
    }
  }, [session.token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!event || !form) return;
    setSaveError(null);
    setNotice(null);
    const changes = changesFrom(event, form);
    if (Object.keys(changes).length === 0) {
      setNotice("No changes to save.");
      return;
    }
    setSaving(true);
    try {
      await updateEventDetails(session.token, event.id, event.version, changes);
      navigate(back, { state: { notice: "Details saved." } });
    } catch (caught) {
      setSaveError(caught);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <Refusal error={loadError} />;
  if (!event || !form) return <p>Loading…</p>;

  const stale = saveError instanceof ApiError && saveError.status === 412;
  const fieldError = (field: string) => (saveError instanceof ApiError ? saveError.fieldMessage(field) : undefined);
  const hasFieldErrors = saveError instanceof ApiError && (saveError.envelope.fields?.length ?? 0) > 0;
  const set = (key: keyof Form) => (value: string) => setForm((current) => ({ ...current!, [key]: value }));

  return (
    <form onSubmit={save} style={{ maxWidth: 760 }}>
      <h2 style={{ marginBottom: 4 }}>Edit event details</h2>
      <p style={{ marginTop: 0, color: "#626F86" }}>
        {event.name} · {event.reference}
      </p>

      {stale && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="warning" title="This event changed after you opened it">
            <p style={{ marginTop: 0 }}>{(saveError as ApiError).envelope.message}</p>
            <Button onClick={() => void load()}>Reload</Button>
          </SectionMessage>
        </div>
      )}
      {saveError && !stale && !hasFieldErrors ? <Refusal error={saveError} /> : null}
      {notice && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="information">
            <p style={{ margin: 0 }}>{notice}</p>
          </SectionMessage>
        </div>
      )}

      <Field id="details-purpose" label="Purpose" error={fieldError("purpose")}>
        <Textfield id="details-purpose" value={form.purpose} onChange={(e) => set("purpose")(e.currentTarget.value)} />
      </Field>
      <Field id="details-description" label="Description" error={fieldError("description")}>
        <TextArea
          id="details-description"
          minimumRows={3}
          value={form.description}
          onChange={(e) => set("description")(e.currentTarget.value)}
        />
      </Field>
      <Field id="details-accessibility" label="Accessibility notes" error={fieldError("accessibilityNeeds")}>
        <TextArea
          id="details-accessibility"
          minimumRows={2}
          value={form.accessibilityNeeds}
          onChange={(e) => set("accessibilityNeeds")(e.currentTarget.value)}
        />
      </Field>
      <Field id="details-contact" label="Contact details" error={fieldError("contactDetails")}>
        <Textfield
          id="details-contact"
          placeholder="For example: a name, email and phone number"
          value={form.contactDetails}
          onChange={(e) => set("contactDetails")(e.currentTarget.value)}
        />
      </Field>

      <section aria-labelledby="details-locked" style={{ margin: "24px 0", padding: 12, background: "#F7F8F9", borderRadius: 4 }}>
        <h3 id="details-locked" style={{ fontSize: 14, marginTop: 0 }}>
          Changed only through a change request
        </h3>
        <p style={{ marginTop: 0, fontSize: 13 }}>
          These can be changed only through a change request, because the arrangements already made depend on them.
        </p>
        <ReadOnly label="Date and time">
          {formatInstant(event.proposedStartAt)} to {formatInstant(event.proposedEndAt)}
        </ReadOnly>
        <ReadOnly label="Expected attendance">{event.expectedAttendance ?? "—"}</ReadOnly>
        <VenueRequirementsView value={event.venueRequirements} />
        <EquipmentRequirementsView required={event.equipmentRequired} lines={event.equipmentRequirements} />
      </section>

      <div style={{ display: "flex", gap: 8 }}>
        <Button appearance="primary" type="submit" isDisabled={saving}>
          Save details
        </Button>
        <Button appearance="subtle" onClick={() => navigate(back)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {error && (
        <div role="alert" style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>
          {error}
        </div>
      )}
    </div>
  );
}

function ReadOnly({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#626F86" }}>{label}</div>
      <div>{children}</div>
    </div>
  );
}
