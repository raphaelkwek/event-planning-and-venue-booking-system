import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { openEvent } from "../api/events.js";
import { saveRegistrationSettings, type RegistrationSettings as Settings } from "../api/registration.js";
import type { EventRecord } from "../api/types.js";
import { Refusal } from "../components/Refusal.js";
import { formatMoment, fromInputs, toInputs } from "../shared/singaporeTime.js";

/**
 * R2, R4 — the owning organiser sets whether attendees register for the
 * event, the registration window (R2) and an optional withdrawal deadline
 * (R4), in Singapore time. The server applies the rules and names each field
 * in error; the save carries the version this screen loaded (If-Match).
 */

type Moment = { date: string; time: string };
type Form = { required: boolean; opens: Moment; closes: Moment; deadline: Moment };

const blank: Moment = { date: "", time: "" };
const inputsOf = (iso: string | null | undefined): Moment => (iso ? toInputs(iso) : blank);

const formOf = (event: EventRecord): Form => ({
  required: event.registrationRequired === true,
  opens: inputsOf(event.registrationOpensAt),
  closes: inputsOf(event.registrationClosesAt),
  deadline: inputsOf(event.withdrawalDeadlineAt),
});

/** An empty pair is no value; a half-filled one is sent so the server names it. */
function instant(m: Moment): string | null {
  if (!m.date && !m.time) return null;
  return fromInputs(m.date, m.time || "00:00");
}

function settingsOf(form: Form): Settings {
  return {
    registrationRequired: form.required,
    registrationOpensAt: form.required ? instant(form.opens) : null,
    registrationClosesAt: form.required ? instant(form.closes) : null,
    withdrawalDeadlineAt: form.required ? instant(form.deadline) : null,
  };
}

const FIELDS = [
  { key: "opens", field: "registrationOpensAt", label: "Registration opens" },
  { key: "closes", field: "registrationClosesAt", label: "Registration closes" },
  { key: "deadline", field: "withdrawalDeadlineAt", label: "Withdrawal deadline (optional)" },
] as const;

export function RegistrationSettings() {
  const session = useSignedIn();
  const { id } = useParams<{ id: string }>();
  const [event, setEvent] = useState<EventRecord | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const loaded = await openEvent(session.token, id!);
      setEvent(loaded);
      setForm(formOf(loaded));
    } catch (e) {
      setLoadError(e);
    }
  }, [session.token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!event || !form) return;
    setSaving(true);
    setSaveError(null);
    setSaved(false);
    try {
      const next = await saveRegistrationSettings(session.token, event.id, event.version, settingsOf(form));
      setEvent(next);
      setForm(formOf(next));
      setSaved(true);
    } catch (error) {
      setSaveError(error);
    } finally {
      setSaving(false);
    }
  }

  const fieldError = (field: string) => (saveError instanceof ApiError ? saveError.fieldMessage(field) : undefined);

  if (loadError) return <Refusal error={loadError} />;
  if (!event || !form) return <Spinner label="Loading the event" />;

  return (
    <section aria-labelledby="settings-heading" style={{ maxWidth: 640 }}>
      <Link to={`/requests/${event.id}`}>Back to the request</Link>
      <h1 id="settings-heading">Registration settings</h1>
      <p>
        {event.reference} “{event.name}”
        {event.proposedStartAt ? `, starting ${formatMoment(event.proposedStartAt)}` : ""}. Times are Singapore time. Without a withdrawal
        deadline, attendees can withdraw until the event starts.
      </p>
      <form onSubmit={(e) => void onSave(e)}>
        <p>
          <label>
            <input type="checkbox" checked={form.required} onChange={(e) => setForm({ ...form, required: e.currentTarget.checked })} /> Attendees
            register for this event
          </label>
        </p>
        {FIELDS.map(({ key, field, label }) => (
          <fieldset key={key} disabled={!form.required} style={{ border: "none", padding: 0, margin: "16px 0" }}>
            <legend>{label}</legend>
            <input
              aria-label={`${label} date`}
              type="date"
              value={form[key].date}
              onChange={(e) => setForm({ ...form, [key]: { ...form[key], date: e.currentTarget.value } })}
            />{" "}
            <input
              aria-label={`${label} time`}
              type="time"
              value={form[key].time}
              onChange={(e) => setForm({ ...form, [key]: { ...form[key], time: e.currentTarget.value } })}
            />
            {fieldError(field) && (
              <p role="alert" style={{ color: "#AE2E24", margin: "4px 0 0" }}>
                {fieldError(field)}
              </p>
            )}
          </fieldset>
        ))}
        <Button appearance="primary" type="submit" isDisabled={saving}>
          Save registration settings
        </Button>
      </form>
      {saved && (
        <SectionMessage appearance="success" title="Registration settings saved.">
          <p>Attendees see the new settings once the registration service has them, usually within seconds.</p>
        </SectionMessage>
      )}
      {saveError !== null && <Refusal error={saveError} />}
    </section>
  );
}
