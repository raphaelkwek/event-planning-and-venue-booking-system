import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Textfield from "@atlaskit/textfield";
import TextArea from "@atlaskit/textarea";
import { Checkbox } from "@atlaskit/checkbox";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import {
  createVenue,
  DAY_LABELS,
  DAYS,
  emptyVenueForm,
  fromVenue,
  getVenue,
  toVenueBody,
  updateVenue,
  type Day,
  type VenueForm,
} from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";

/**
 * H1 — Venue Staff create and update a venue record. Each refusal is shown
 * with the server's message, and each field's problem under that field. After
 * a save the form shows what the server stored, not what was typed.
 */
export function VenueEditor() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const venueId = id && id !== "new" ? id : null;
  const [form, setForm] = useState<VenueForm>(emptyVenueForm);
  const [error, setError] = useState<unknown>(null);
  // A new venue moves to its own address once saved; the notice travels with it.
  const [notice, setNotice] = useState<string | null>((location.state as { saved?: boolean } | null)?.saved ? "Venue saved." : null);
  const [loading, setLoading] = useState(Boolean(venueId));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!venueId) {
      setForm(emptyVenueForm());
      setLoading(false);
      return;
    }
    getVenue(session.token, venueId)
      .then((venue) => setForm(fromVenue(venue)))
      .catch(setError)
      .finally(() => setLoading(false));
  }, [session.token, venueId]);

  const fieldError = (name: string) => (error instanceof ApiError ? error.fieldMessage(name) : undefined);

  function update(change: (draft: VenueForm) => void) {
    setForm((current) => {
      const next = structuredClone(current);
      change(next);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = toVenueBody(form);
      const saved = venueId ? await updateVenue(session.token, venueId, body) : await createVenue(session.token, body);
      setForm(fromVenue(saved));
      setNotice("Venue saved.");
      if (!venueId) navigate(`/venues/${saved.id}/edit`, { replace: true, state: { saved: true } });
    } catch (caught) {
      setError(caught);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p>Loading…</p>;

  return (
    <div style={{ maxWidth: 760 }}>
      <h2>{venueId ? "Edit venue" : "New venue"}</h2>

      {notice && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="success">
            <p style={{ margin: 0 }}>{notice}</p>
          </SectionMessage>
        </div>
      )}
      <div style={{ marginBottom: 16 }}>
        <Refusal error={error} />
      </div>

      <Field id="venue-name" label="Name" error={fieldError("name")}>
        <Textfield id="venue-name" value={form.name} onChange={(e) => update((f) => void (f.name = e.currentTarget.value))} />
      </Field>
      <Field id="venue-building" label="Building / location" error={fieldError("building")}>
        <Textfield
          id="venue-building"
          value={form.building}
          onChange={(e) => update((f) => void (f.building = e.currentTarget.value))}
        />
      </Field>
      <Field id="venue-capacity" label="Maximum capacity" error={fieldError("maxCapacity")}>
        <Textfield
          id="venue-capacity"
          inputMode="numeric"
          value={form.maxCapacity}
          onChange={(e) => update((f) => void (f.maxCapacity = e.currentTarget.value))}
        />
      </Field>

      <Section title="Layouts" error={fieldError("layouts")}>
        {form.layouts.map((layout, index) => (
          <div key={index} data-testid={`layout-${index + 1}`} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
            <div style={{ flex: 2 }}>
              <Field id={`layout-${index}-name`} label={`Layout ${index + 1}`} error={fieldError(`layouts[${index}].name`)}>
                <Textfield
                  id={`layout-${index}-name`}
                  value={layout.name}
                  onChange={(e) => update((f) => void (f.layouts[index]!.name = e.currentTarget.value))}
                />
              </Field>
            </div>
            <div style={{ flex: 1 }}>
              <Field
                id={`layout-${index}-capacity`}
                label={`Layout ${index + 1} capacity`}
                error={fieldError(`layouts[${index}].capacity`)}
              >
                <Textfield
                  id={`layout-${index}-capacity`}
                  inputMode="numeric"
                  value={layout.capacity}
                  onChange={(e) => update((f) => void (f.layouts[index]!.capacity = e.currentTarget.value))}
                />
              </Field>
            </div>
            <div style={{ paddingTop: 20 }}>
              <Button appearance="subtle" onClick={() => update((f) => void f.layouts.splice(index, 1))}>
                Remove
              </Button>
            </div>
          </div>
        ))}
        <Button onClick={() => update((f) => void f.layouts.push({ name: "", capacity: "" }))}>Add layout</Button>
      </Section>

      <Field id="venue-facilities" label="Facilities (one per line)" error={fieldError("facilities")}>
        <TextArea
          id="venue-facilities"
          minimumRows={3}
          value={form.facilities}
          onChange={(e) => update((f) => void (f.facilities = e.currentTarget.value))}
        />
      </Field>
      <Field id="venue-accessibility" label="Accessibility features (one per line)" error={fieldError("accessibilityFeatures")}>
        <TextArea
          id="venue-accessibility"
          minimumRows={3}
          value={form.accessibilityFeatures}
          onChange={(e) => update((f) => void (f.accessibilityFeatures = e.currentTarget.value))}
        />
      </Field>

      <Section title="Operating hours">
        {DAYS.map((day) => (
          <DayRow key={day} day={day} form={form} error={fieldError(`operatingHours.${day}`)} update={update} />
        ))}
      </Section>

      {venueId && (
        <div style={{ margin: "12px 0" }}>
          <Checkbox
            isChecked={form.isActive}
            onChange={(e) => update((f) => void (f.isActive = e.target.checked))}
            label="Active"
          />
          <p style={{ fontSize: 12, color: "#626F86", margin: "4px 0 0" }}>
            An inactive venue keeps its record, history and bookings, but is no longer offered in venue search.
          </p>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button appearance="primary" isDisabled={saving} onClick={() => void save()}>
          Save venue
        </Button>
        <Button appearance="subtle" onClick={() => navigate("/venues")}>
          Back to venues
        </Button>
      </div>
    </div>
  );
}

function DayRow({
  day,
  form,
  error,
  update,
}: {
  day: Day;
  form: VenueForm;
  error?: string;
  update: (change: (draft: VenueForm) => void) => void;
}) {
  const hours = form.hours[day];
  const label = DAY_LABELS[day];
  return (
    <div data-testid={`hours-${day}`} style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <strong style={{ width: 100 }}>{label}</strong>
        <Checkbox
          isChecked={hours.closed}
          onChange={(e) => update((f) => void (f.hours[day].closed = e.target.checked))}
          label={`Closed`}
          aria-label={`${label} closed`}
        />
        <label htmlFor={`hours-${day}-opens`} style={{ fontSize: 12 }}>
          Opens
        </label>
        <input
          id={`hours-${day}-opens`}
          aria-label={`${label} opens`}
          type="time"
          disabled={hours.closed}
          value={hours.opensAt}
          onChange={(e) => update((f) => void (f.hours[day].opensAt = e.currentTarget.value))}
        />
        <label htmlFor={`hours-${day}-closes`} style={{ fontSize: 12 }}>
          Closes
        </label>
        <input
          id={`hours-${day}-closes`}
          aria-label={`${label} closes`}
          type="time"
          disabled={hours.closed}
          value={hours.closesAt}
          onChange={(e) => update((f) => void (f.hours[day].closesAt = e.currentTarget.value))}
        />
      </div>
      {error && <FieldError message={error} />}
    </div>
  );
}

function Section({ title, error, children }: { title: string; error?: string; children: ReactNode }) {
  return (
    <fieldset style={{ border: "1px solid #DFE1E6", borderRadius: 4, padding: 12, margin: "12px 0" }}>
      <legend style={{ fontWeight: 600, fontSize: 12, padding: "0 4px" }}>{title}</legend>
      {children}
      {error && <FieldError message={error} />}
    </fieldset>
  );
}

function Field({ id, label, error, children }: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label htmlFor={id} style={{ display: "block", fontWeight: 600, fontSize: 12, marginBottom: 4 }}>
        {label}
      </label>
      {children}
      {error && <FieldError message={error} />}
    </div>
  );
}

function FieldError({ message }: { message: string }) {
  return <div style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>{message}</div>;
}
