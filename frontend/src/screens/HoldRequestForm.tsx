import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { listEventBookingRequests, type BookingEvent } from "../api/bookingRequests.js";
import { requestHold } from "../api/holds.js";
import { listVenues, type VenueListItem } from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";
import { fromInputs, toInputs } from "../shared/singaporeTime.js";

/**
 * L3 — the assigned coordinator asks for a tentative hold: a venue, a date and
 * times (starting from the event's), and how long before the expiry to be
 * reminded. Venue Staff then place it and set the expiry; until then it
 * reserves nothing.
 */

interface Form {
  venueId: string;
  date: string;
  start: string;
  end: string;
  reminder: string;
}

/** A day's notice, unless the coordinator chooses otherwise. */
const DEFAULT_REMINDER_MINUTES = "1440";

export function HoldRequestForm() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<BookingEvent | null>(null);
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    Promise.all([listEventBookingRequests(session.token, id!), listVenues(session.token)])
      .then(([loaded, catalogue]) => {
        const start = loaded.event.proposedStartAt ? toInputs(loaded.event.proposedStartAt) : { date: "", time: "" };
        const end = loaded.event.proposedEndAt ? toInputs(loaded.event.proposedEndAt) : { date: "", time: "" };
        setEvent(loaded.event);
        setForm({ venueId: "", date: start.date, start: start.time, end: end.time, reminder: DEFAULT_REMINDER_MINUTES });
        setVenues(catalogue.items.filter((item) => item.isActive));
      })
      .catch(setLoadError);
  }, [session.token, id]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!event || !form) return;
    setSaveError(null);
    setSaving(true);
    const reminder = Number(form.reminder);
    try {
      const hold = await requestHold(session.token, {
        eventId: event.id,
        venueId: form.venueId,
        startsAt: fromInputs(form.date, form.start),
        endsAt: fromInputs(form.date, form.end),
        reminderLeadMinutes: form.reminder.trim() === "" || !Number.isFinite(reminder) ? null : reminder,
      });
      navigate(`/events/${event.id}/venue-requests`, { state: { notice: `Hold ${hold.reference} requested.` } });
    } catch (caught) {
      setSaveError(caught);
    } finally {
      setSaving(false);
    }
  }

  if (loadError) return <Refusal error={loadError} />;
  if (!event || !form) return <p>Loading…</p>;

  const fieldError = (field: string) => (saveError instanceof ApiError ? saveError.fieldMessage(field) : undefined);
  const hasFieldErrors = saveError instanceof ApiError && (saveError.envelope.fields?.length ?? 0) > 0;
  const set = (key: keyof Form) => (value: string) => setForm((current) => ({ ...current!, [key]: value }));

  return (
    <form onSubmit={submit} style={{ maxWidth: 640 }}>
      <h2 style={{ marginBottom: 4 }}>Request a hold</h2>
      <p style={{ marginTop: 0, color: "#626F86" }}>
        {event.name} · {event.reference}. Times are Singapore time. Venue Staff place the hold and set when it expires; until
        then it reserves nothing.
      </p>

      {saveError && !hasFieldErrors ? <Refusal error={saveError} /> : null}

      <Field id="hold-venue" label="Venue" error={fieldError("venueId")}>
        <select id="hold-venue" value={form.venueId} onChange={(e) => set("venueId")(e.currentTarget.value)} style={input}>
          <option value="">Choose a venue</option>
          {venues.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field id="hold-date" label="Date" error={fieldError("startsAt")}>
          <input id="hold-date" type="date" value={form.date} onChange={(e) => set("date")(e.currentTarget.value)} style={input} />
        </Field>
        <Field id="hold-start" label="Start time">
          <input id="hold-start" type="time" value={form.start} onChange={(e) => set("start")(e.currentTarget.value)} style={input} />
        </Field>
        <Field id="hold-end" label="End time" error={fieldError("endsAt")}>
          <input id="hold-end" type="time" value={form.end} onChange={(e) => set("end")(e.currentTarget.value)} style={input} />
        </Field>
      </div>

      <Field id="hold-reminder" label="Remind me this many minutes before it expires" error={fieldError("reminderLeadMinutes")}>
        <input id="hold-reminder" inputMode="numeric" value={form.reminder} onChange={(e) => set("reminder")(e.currentTarget.value)} style={input} />
      </Field>

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button appearance="primary" type="submit" isDisabled={saving}>
          Request hold
        </Button>
        <Button appearance="subtle" onClick={() => navigate(`/events/${event.id}/venue-requests`)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

const input = { padding: "6px 8px", border: "2px solid #DFE1E6", borderRadius: 3, font: "inherit", minWidth: 160 };

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
