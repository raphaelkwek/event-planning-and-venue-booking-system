import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import SectionMessage from "@atlaskit/section-message";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { createBookingRequest, listEventBookingRequests, type BookingEvent } from "../api/bookingRequests.js";
import { convertHold, listEventHolds, type Hold } from "../api/holds.js";
import { getVenue, listVenues, type SuitabilityCondition, type Venue, type VenueListItem } from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";
import { fromInputs, toInputs } from "../shared/singaporeTime.js";
import { SUITABILITY_APPEARANCE, SUITABILITY_LABELS } from "../shared/status.js";

/**
 * L1 — the assigned coordinator asks for a venue. The date, times and
 * attendance start from the event; changing any of them flags the request as
 * differing from the event, which Venue Staff then see. The layout, facilities
 * and accessibility features are the chosen venue's, with the ones the event
 * asks for already chosen.
 *
 * K2 — the server assesses the venue against the request. When it isn't
 * suitable, the form lists the failing conditions and asks for a justification,
 * which is sent with the next submission.
 *
 * L5 — opened from "Request this venue" in a replacement search, it starts from
 * that venue and the disrupted booking's period instead, and the request is
 * linked to the booking it replaces (CR-02).
 *
 * L3 — opened with `?hold=<id>`, it converts that held hold into a request: the
 * venue, date and times are the hold's and can't be changed. K2's justification
 * applies to the conversion as it does to a direct request.
 */

interface Form {
  venueId: string;
  date: string;
  start: string;
  end: string;
  layout: string;
  attendance: string;
  facilities: string[];
  accessibility: string[];
}

const lower = (values: readonly string[]) => values.map((value) => value.toLowerCase());

function startFrom(event: BookingEvent): Form {
  const start = event.proposedStartAt ? toInputs(event.proposedStartAt) : { date: "", time: "" };
  const end = event.proposedEndAt ? toInputs(event.proposedEndAt) : { date: "", time: "" };
  return {
    venueId: "",
    date: start.date,
    start: start.time,
    end: end.time,
    layout: "",
    attendance: event.expectedAttendance === null ? "" : String(event.expectedAttendance),
    facilities: [],
    accessibility: [],
  };
}

export function BookingRequestForm() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  // L5: the disrupted booking this request replaces, with the venue and period to start from.
  const replaces = params.get("replaces");
  const replacing = replaces
    ? { bookingId: replaces, booking: params.get("booking") ?? "", venue: params.get("venue") ?? "", venueId: params.get("venueId") ?? "", from: params.get("from") ?? "", to: params.get("to") ?? "" }
    : null;
  const holdId = params.get("hold");
  const [event, setEvent] = useState<BookingEvent | null>(null);
  const [hold, setHold] = useState<Hold | null>(null);
  const [venues, setVenues] = useState<VenueListItem[]>([]);
  const [venue, setVenue] = useState<Venue | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [saveError, setSaveError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [unsuitable, setUnsuitable] = useState<{ message: string; reasons: SuitabilityCondition[] } | null>(null);
  const [justification, setJustification] = useState("");

  useEffect(() => {
    Promise.all([
      listEventBookingRequests(session.token, id!),
      listVenues(session.token),
      holdId ? listEventHolds(session.token, id!) : Promise.resolve({ items: [] as Hold[] }),
    ])
      .then(([loaded, catalogue, holds]) => {
        setEvent(loaded.event);
        setVenues(catalogue.items.filter((item) => item.isActive));
        const converting = holds.items.find((item) => item.id === holdId) ?? null;
        setHold(converting);
        if (converting) {
          const start = toInputs(converting.startsAt);
          setForm({ ...startFrom(loaded.event), date: start.date, start: start.time, end: toInputs(converting.endsAt).time });
          void chooseVenue(converting.venueId, loaded.event);
        } else {
          const start = startFrom(loaded.event);
          setForm(replacing?.from && replacing.to
            ? { ...start, date: replacing.from.slice(0, 10), start: replacing.from.slice(11, 16), end: replacing.to.slice(11, 16) }
            : start);
          if (replacing?.venueId) void chooseVenue(replacing.venueId, loaded.event);
        }
      })
      .catch(setLoadError);
    // Replacement parameters are read when the form opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token, id, holdId]);

  async function chooseVenue(venueId: string, forEvent: BookingEvent | null = event) {
    setForm((current) => ({ ...current!, venueId, layout: "", facilities: [], accessibility: [] }));
    setVenue(null);
    setUnsuitable(null);
    setJustification("");
    if (!venueId) return;
    const chosen = await getVenue(session.token, venueId);
    const wanted = forEvent?.venueRequirements;
    const needs = (forEvent?.accessibilityNeeds ?? "").toLowerCase();
    const layout = chosen.layouts.find((l) => l.name.toLowerCase() === (wanted?.layout ?? "").toLowerCase())?.name ?? "";
    setVenue(chosen);
    setForm((current) => ({
      ...current!,
      layout,
      facilities: chosen.facilities.filter((f) => lower(wanted?.facilities ?? []).includes(f.toLowerCase())),
      accessibility: chosen.accessibilityFeatures.filter((a) => needs.includes(a.toLowerCase())),
    }));
  }

  function toggle(key: "facilities" | "accessibility", name: string, checked: boolean) {
    setForm((current) => ({
      ...current!,
      [key]: checked ? [...current![key], name] : current![key].filter((item) => item !== name),
    }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!event || !form) return;
    setSaveError(null);
    setSaving(true);
    const attendance = Number(form.attendance);
    const details = {
      layout: form.layout,
      expectedAttendance: form.attendance.trim() === "" || !Number.isFinite(attendance) ? null : attendance,
      // In the venue's own order, as the catalogue lists them.
      facilities: venue ? venue.facilities.filter((f) => form.facilities.includes(f)) : form.facilities,
      accessibilityFeatures: venue ? venue.accessibilityFeatures.filter((a) => form.accessibility.includes(a)) : form.accessibility,
      // K2: sent once the server has said the venue isn't suitable, for a conversion as for a direct request.
      ...(unsuitable ? { justification } : {}),
    };
    try {
      const created = hold
        ? (await convertHold(session.token, hold.id, details)).request
        : await createBookingRequest(session.token, {
            eventId: event.id,
            venueId: form.venueId,
            startsAt: fromInputs(form.date, form.start),
            endsAt: fromInputs(form.date, form.end),
            ...details,
            ...(replacing ? { replacesBookingId: replacing.bookingId } : {}),
          });
      navigate(`/events/${event.id}/venue-requests`, { state: { notice: `Booking request ${created.reference} submitted.` } });
    } catch (caught) {
      if (caught instanceof ApiError && caught.envelope.code === "JUSTIFICATION_REQUIRED") {
        const reasons = (caught.envelope.details?.reasons ?? []) as SuitabilityCondition[];
        setUnsuitable({ message: caught.envelope.message, reasons });
      }
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
      <h2 style={{ marginBottom: 4 }}>{hold ? `Convert ${hold.reference} into a request` : "Request a venue"}</h2>
      <p style={{ marginTop: 0, color: "#626F86" }}>
        {event.name} · {event.reference}. Times are Singapore time.
        {hold && " The venue, date and times are the hold's. The period stays held while Venue Staff decide."}
      </p>

      {replacing && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="information" title="Replacement request">
            <p style={{ margin: 0 }}>
              This request replaces {replacing.booking} at {replacing.venue}, which is unavailable. That booking is kept until
              this request is approved, and then released.
            </p>
          </SectionMessage>
        </div>
      )}

      {saveError && !hasFieldErrors ? <Refusal error={saveError} /> : null}

      <Field id="booking-venue" label="Venue" error={fieldError("venueId")}>
        <select
          id="booking-venue"
          disabled={Boolean(hold)}
          value={form.venueId}
          onChange={(e) => {
            const value = e.currentTarget.value;
            void chooseVenue(value);
          }}
          style={input}
        >
          <option value="">Choose a venue</option>
          {venues.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Field>

      <div style={{ display: "flex", gap: 12 }}>
        <Field id="booking-date" label="Date" error={fieldError("startsAt")}>
          <input id="booking-date" type="date" disabled={Boolean(hold)} value={form.date} onChange={(e) => set("date")(e.currentTarget.value)} style={input} />
        </Field>
        <Field id="booking-start" label="Start time">
          <input id="booking-start" type="time" disabled={Boolean(hold)} value={form.start} onChange={(e) => set("start")(e.currentTarget.value)} style={input} />
        </Field>
        <Field id="booking-end" label="End time" error={fieldError("endsAt")}>
          <input id="booking-end" type="time" disabled={Boolean(hold)} value={form.end} onChange={(e) => set("end")(e.currentTarget.value)} style={input} />
        </Field>
      </div>

      <Field id="booking-layout" label="Room layout" error={fieldError("layout")}>
        <select id="booking-layout" value={form.layout} onChange={(e) => set("layout")(e.currentTarget.value)} style={input}>
          <option value="">{venue ? "Choose a layout" : "Choose a venue first"}</option>
          {venue?.layouts.map((layout) => (
            <option key={layout.name} value={layout.name}>
              {layout.name}
            </option>
          ))}
        </select>
      </Field>

      <Field id="booking-attendance" label="Expected attendance" error={fieldError("expectedAttendance")}>
        <input
          id="booking-attendance"
          inputMode="numeric"
          value={form.attendance}
          onChange={(e) => set("attendance")(e.currentTarget.value)}
          style={input}
        />
      </Field>

      {venue && (
        <>
          <Checkboxes legend="Facilities" names={venue.facilities} chosen={form.facilities} onToggle={(n, c) => toggle("facilities", n, c)} />
          <Checkboxes
            legend="Accessibility features"
            names={venue.accessibilityFeatures}
            chosen={form.accessibility}
            onToggle={(n, c) => toggle("accessibility", n, c)}
          />
        </>
      )}

      {unsuitable && (
        <section aria-label="Not suitable" style={{ border: "1px solid #DFE1E6", borderRadius: 3, padding: 12, marginBottom: 12 }}>
          <Lozenge appearance={SUITABILITY_APPEARANCE.NOT_SUITABLE}>{SUITABILITY_LABELS.NOT_SUITABLE}</Lozenge>
          <p style={{ margin: "8px 0 4px" }}>{unsuitable.message}</p>
          <ul style={{ margin: "0 0 8px", paddingLeft: 20 }}>
            {unsuitable.reasons.map((reason) => (
              <li key={reason.condition}>{reason.message}</li>
            ))}
          </ul>
          <Field id="booking-justification" label="Justification" error={fieldError("justification")}>
            <textarea
              id="booking-justification"
              rows={3}
              value={justification}
              onChange={(e) => setJustification(e.currentTarget.value)}
              style={{ ...input, width: "100%", boxSizing: "border-box" }}
            />
          </Field>
        </section>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <Button appearance="primary" type="submit" isDisabled={saving}>
          Submit request
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

function Checkboxes(props: { legend: string; names: string[]; chosen: string[]; onToggle: (name: string, checked: boolean) => void }) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: "0 0 12px" }}>
      <legend style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{props.legend}</legend>
      {props.names.length === 0 && <p style={{ margin: 0 }}>The venue records none.</p>}
      {props.names.map((name) => (
        <label key={name} style={{ display: "block" }}>
          <input
            type="checkbox"
            checked={props.chosen.includes(name)}
            onChange={(e) => {
              const checked = e.currentTarget.checked;
              props.onToggle(name, checked);
            }}
          />{" "}
          {name}
        </label>
      ))}
    </fieldset>
  );
}
