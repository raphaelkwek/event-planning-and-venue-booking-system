import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import {
  getVenue,
  getVenueAvailability,
  type AvailabilityDay,
  type CommittedPeriod,
  type VenueAvailability as Calendar,
} from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";
import {
  CALENDAR_APPEARANCE,
  CALENDAR_BAR_COLOURS,
  CALENDAR_LABELS,
  UNAVAILABILITY_LABELS,
  type CalendarState,
} from "../shared/status.js";

/**
 * I1 — when a venue is already committed, so a coordinator requests a period it
 * can actually offer. For each day of the chosen range: the committed periods
 * (bookings, pending requests, their setup and turnaround, unavailability, and
 * the hours the venue is closed) and the free periods left. Read from the
 * server every time "Show" is clicked, so a decision made since shows (AC7).
 * Attendees never reach this screen (AC8): App.tsx gives it no route for them,
 * and the API refuses them.
 */

const TIME_ZONE = "Asia/Singapore";
const DAY_MS = 24 * 60 * 60 * 1000;

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** "Monday 7 December 2026". */
function dayName(date: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).formatToParts(Date.parse(`${date}T00:00:00Z`));
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/** HH:MM–HH:MM in the calendar's time zone. Periods never cross midnight, so an end at 00:00 is 24:00. */
function span(period: { startsAt: string; endsAt: string }, timeZone: string): string {
  const clock = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const end = clock.format(new Date(period.endsAt));
  return `${clock.format(new Date(period.startsAt))}–${end === "00:00" ? "24:00" : end}`;
}

function stateOf(period: CommittedPeriod): CalendarState {
  if (period.kind === "BOOKING") return period.bookingStatus === "PENDING" ? "PENDING" : "CONFIRMED";
  return period.kind;
}

function lozengeText(period: CommittedPeriod): string {
  if (period.kind === "UNAVAILABLE") return UNAVAILABILITY_LABELS[period.reasonType!] ?? period.reasonType!;
  return CALENDAR_LABELS[stateOf(period) as Exclude<CalendarState, "UNAVAILABLE">];
}

function detail(period: CommittedPeriod, timeZone: string): string {
  const reference = period.eventReference ?? "Unknown event";
  switch (period.kind) {
    case "BOOKING":
      return reference;
    case "SETUP":
    case "TURNAROUND":
      return `${reference} · occupied`;
    case "UNAVAILABLE":
      return period.description ?? "";
    case "OUTSIDE_HOURS":
      return span(period, timeZone) === "00:00–24:00" ? "Closed all day" : "";
  }
}

export function VenueAvailability() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams();
  const [venueName, setVenueName] = useState<string | null>(null);
  // The week from today is shown on opening; after that only "Show" asks again.
  const [opening] = useState(() => ({ from: today(), to: addDays(today(), 6) }));
  const [from, setFrom] = useState(opening.from);
  const [to, setTo] = useState(opening.to);
  const [calendar, setCalendar] = useState<Calendar | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  const show = useCallback(
    (start: string, end: string) => {
      setLoading(true);
      setError(null);
      getVenueAvailability(session.token, id!, start, end)
        .then((result) => setCalendar(result))
        .catch((reason) => {
          setCalendar(null);
          setError(reason);
        })
        .finally(() => setLoading(false));
    },
    [session.token, id],
  );

  useEffect(() => {
    getVenue(session.token, id!)
      .then((venue) => setVenueName(venue.name))
      .catch(setError);
  }, [session.token, id]);

  useEffect(() => show(opening.from, opening.to), [show, opening]);

  function submit(e: FormEvent) {
    e.preventDefault();
    show(from, to);
  }

  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldMessage(field) : undefined);
  const hasFieldErrors = Boolean(fieldError("from") || fieldError("to"));

  return (
    <div style={{ maxWidth: 960 }}>
      <h2>{venueName ?? "Venue"}</h2>
      <p style={{ marginTop: 0 }}>Availability. Times are Singapore time.</p>

      <form onSubmit={submit} style={{ display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap", margin: "16px 0" }}>
        <DateField label="From" value={from} onChange={setFrom} error={fieldError("from")} />
        <DateField label="To" value={to} onChange={setTo} error={fieldError("to")} />
        <div style={{ paddingTop: 22 }}>
          <Button appearance="primary" type="submit" isDisabled={loading}>
            Show
          </Button>
        </div>
      </form>

      {error && !hasFieldErrors ? <Refusal error={error} /> : null}

      {calendar && (
        <>
          <Legend />
          {calendar.days.map((day) => (
            <Day key={day.date} day={day} timeZone={calendar.timeZone} />
          ))}
        </>
      )}

      <p>
        <Button appearance="subtle" onClick={() => navigate(`/venues/${id}`)}>
          Back to venue
        </Button>
      </p>
    </div>
  );
}

function DateField(props: { label: string; value: string; onChange: (value: string) => void; error?: string }) {
  const inputId = `availability-${props.label.toLowerCase()}`;
  return (
    <div>
      <label htmlFor={inputId} style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {props.label}
      </label>
      <input
        id={inputId}
        type="date"
        value={props.value}
        onChange={(e) => {
          const value = e.currentTarget.value;
          props.onChange(value);
        }}
        aria-invalid={props.error ? true : undefined}
        aria-describedby={props.error ? `${inputId}-error` : undefined}
        style={{ padding: "6px 8px", border: "2px solid #DFE1E6", borderRadius: 3, font: "inherit" }}
      />
      {props.error && (
        <div id={`${inputId}-error`} role="alert" style={{ color: "#AE2A19", fontSize: 12, marginTop: 4, maxWidth: 260 }}>
          {props.error}
        </div>
      )}
    </div>
  );
}

function Legend() {
  const states: CalendarState[] = ["CONFIRMED", "PENDING", "SETUP", "TURNAROUND", "UNAVAILABLE", "OUTSIDE_HOURS", "FREE"];
  return (
    <p aria-hidden style={{ display: "flex", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
      {states.map((state) => (
        <span key={state} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: CALENDAR_BAR_COLOURS[state] }} />
          {state === "UNAVAILABLE" ? "Unavailable" : CALENDAR_LABELS[state]}
        </span>
      ))}
    </p>
  );
}

function Day({ day, timeZone }: { day: AvailabilityDay; timeZone: string }) {
  const name = dayName(day.date);
  const headingId = `day-${day.date}`;
  return (
    <section aria-labelledby={headingId} style={{ margin: "16px 0", paddingTop: 8, borderTop: "1px solid #DFE1E6" }}>
      <h3 id={headingId} style={{ fontSize: 14, marginBottom: 8 }}>
        {name}
      </h3>
      <DayBar day={day} timeZone={timeZone} />
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)", gap: 24 }}>
        <div>
          <h4 id={`${headingId}-committed`} style={{ fontSize: 12, margin: "8px 0 4px" }}>
            Committed
          </h4>
          {day.committed.length === 0 ? (
            <p style={{ margin: 0 }}>Nothing committed</p>
          ) : (
            <ul aria-labelledby={`${headingId}-committed`} style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
              {day.committed.map((period, i) => (
                <li key={i} style={{ display: "flex", gap: 8, alignItems: "center", padding: "2px 0" }}>
                  <span style={{ fontVariantNumeric: "tabular-nums", minWidth: 96 }}>{span(period, timeZone)}</span>{" "}
                  <Lozenge appearance={CALENDAR_APPEARANCE[stateOf(period)]}>{lozengeText(period)}</Lozenge>{" "}
                  <span>{detail(period, timeZone)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 id={`${headingId}-free`} style={{ fontSize: 12, margin: "8px 0 4px" }}>
            Free
          </h4>
          {day.free.length === 0 ? (
            <p style={{ margin: 0 }}>No free periods</p>
          ) : (
            <ul aria-labelledby={`${headingId}-free`} style={{ margin: 0, paddingLeft: 0, listStyle: "none" }}>
              {day.free.map((period) => (
                <li key={period.startsAt} style={{ fontVariantNumeric: "tabular-nums", padding: "2px 0" }}>
                  {span(period, timeZone)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

/** The day at a glance, midnight to midnight. The lists say the same in words. */
function DayBar({ day, timeZone }: { day: AvailabilityDay; timeZone: string }) {
  const minutes = (text: string) => {
    const [h, m] = text.split(":").map(Number);
    return h! * 60 + m!;
  };
  const segment = (period: { startsAt: string; endsAt: string }, state: CalendarState, key: string) => {
    const [start, end] = span(period, timeZone).split("–") as [string, string];
    const left = (minutes(start) / 1440) * 100;
    const width = ((minutes(end) - minutes(start)) / 1440) * 100;
    return (
      <span
        key={key}
        style={{ position: "absolute", top: 0, bottom: 0, left: `${left}%`, width: `${width}%`, background: CALENDAR_BAR_COLOURS[state] }}
      />
    );
  };
  return (
    <div aria-hidden style={{ position: "relative", height: 14, borderRadius: 3, background: "#F4F5F7", overflow: "hidden" }}>
      {day.free.map((period, i) => segment(period, "FREE", `free-${i}`))}
      {day.committed.map((period, i) => segment(period, stateOf(period), `committed-${i}`))}
    </div>
  );
}
