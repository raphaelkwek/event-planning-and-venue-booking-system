import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import DynamicTable from "@atlaskit/dynamic-table";
import SectionMessage from "@atlaskit/section-message";
import { Checkbox } from "@atlaskit/checkbox";
import Textfield from "@atlaskit/textfield";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import {
  emptySearchForm,
  formFromPrefill,
  getSearchOptions,
  getSearchPrefill,
  searchVenues,
  type VenueSearchForm,
  type VenueSearchOptions,
  type VenueSearchResult,
} from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";

/**
 * J1, J2 — find a venue for an event: search by part of a name or building,
 * and filter by the date and time window, minimum capacity, building, layout,
 * facilities and accessibility features. Only venues meeting every filter are
 * listed. Event Coordinators only (A2): App.tsx gives no other role a route,
 * and the server refuses them anyway.
 *
 * Opened from an event (`?eventId=`), the filters start from that event's
 * requirements and stay editable (J1). Opened on its own, it starts by listing
 * every active venue (J2). An empty result is not an error: it says which
 * filters were applied. Times are Singapore time.
 */

const FIELD_STYLE = { padding: "6px 8px", border: "2px solid #DFE1E6", borderRadius: 3, font: "inherit", background: "#fff" };
const FIELDS_WITH_OWN_ERROR = ["q", "from", "to", "minCapacity", "location", "layout"];

export function VenueSearch() {
  const session = useSignedIn();
  const [params] = useSearchParams();
  const eventId = params.get("eventId");
  const [form, setForm] = useState<VenueSearchForm>(emptySearchForm);
  const [options, setOptions] = useState<VenueSearchOptions>({ layouts: [], facilities: [], accessibilityFeatures: [] });
  const [result, setResult] = useState<VenueSearchResult | null>(null);
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [fromEvent, setFromEvent] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  // Only the latest search may show its result: an older one finishing late must not replace it.
  const latest = useRef(0);

  const run = useCallback(
    (searched: VenueSearchForm) => {
      const mine = ++latest.current;
      setLoading(true);
      setError(null);
      searchVenues(session.token, searched)
        .then((found) => mine === latest.current && setResult(found))
        .catch((reason) => {
          if (mine !== latest.current) return;
          setResult(null);
          setError(reason);
        })
        .finally(() => mine === latest.current && setLoading(false));
    },
    [session.token],
  );

  useEffect(() => {
    getSearchOptions(session.token).then(setOptions).catch(setError);
    if (!eventId) {
      run(emptySearchForm());
      return;
    }
    getSearchPrefill(session.token, eventId)
      .then((prefill) => {
        const prefilled = formFromPrefill(prefill);
        setForm(prefilled);
        setUnmatched(prefill.unmatchedAccessibility);
        setFromEvent(prefill.reference ?? "this event");
        run(prefilled);
      })
      .catch((reason) => {
        // run() clears the error, so show this one after it.
        run(emptySearchForm());
        setError(reason);
      });
  }, [session.token, eventId, run]);

  const set = (patch: Partial<VenueSearchForm>) => setForm((current) => ({ ...current, ...patch }));
  const toggle = (key: "facilities" | "accessibility", name: string, on: boolean) =>
    set({ [key]: on ? [...form[key], name] : form[key].filter((entry) => entry !== name) });

  function submit(e: FormEvent) {
    e.preventDefault();
    run(form);
  }

  function clear() {
    const cleared = emptySearchForm();
    setForm(cleared);
    setUnmatched([]);
    run(cleared);
  }

  const fieldError = (field: string) => (error instanceof ApiError ? error.fieldMessage(field) : undefined);
  const hasFieldErrors = error instanceof ApiError && FIELDS_WITH_OWN_ERROR.some((field) => fieldError(field));
  const withSelected = (offered: string[], selected: string[]) => [
    ...offered,
    ...selected.filter((name) => !offered.some((entry) => entry.toLowerCase() === name.toLowerCase())),
  ];

  return (
    <div style={{ maxWidth: 1040 }}>
      <h2>Find a venue</h2>
      <p style={{ marginTop: 0 }}>
        {fromEvent ? `Filters start from the requirements of ${fromEvent}; change any of them. ` : ""}
        Only venues that meet every filter are listed. Times are Singapore time.
      </p>

      <form onSubmit={submit} aria-label="Venue search" style={{ display: "grid", gap: 16, margin: "16px 0" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <TextField id="venue-search-q" label="Search by name or building" error={fieldError("q")}>
            <Textfield
              id="venue-search-q"
              value={form.q}
              onChange={(e) => set({ q: e.currentTarget.value })}
              isInvalid={Boolean(fieldError("q"))}
            />
          </TextField>
          <TextField id="venue-search-location" label="Building / location" error={fieldError("location")}>
            <Textfield
              id="venue-search-location"
              value={form.location}
              onChange={(e) => set({ location: e.currentTarget.value })}
              isInvalid={Boolean(fieldError("location"))}
            />
          </TextField>
          <TextField id="venue-search-capacity" label="Minimum capacity" error={fieldError("minCapacity")}>
            <Textfield
              id="venue-search-capacity"
              inputMode="numeric"
              value={form.minCapacity}
              onChange={(e) => set({ minCapacity: e.currentTarget.value })}
              isInvalid={Boolean(fieldError("minCapacity"))}
            />
          </TextField>
          <TextField id="venue-search-layout" label="Layout" error={fieldError("layout")}>
            <select
              id="venue-search-layout"
              value={form.layout}
              onChange={(e) => set({ layout: e.currentTarget.value })}
              style={FIELD_STYLE}
            >
              <option value="">Any layout</option>
              {withSelected(options.layouts, form.layout ? [form.layout] : []).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </TextField>
        </div>

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
          <TextField id="venue-search-from" label="From" error={fieldError("from")}>
            <input
              id="venue-search-from"
              type="datetime-local"
              value={form.from}
              onChange={(e) => set({ from: e.currentTarget.value })}
              aria-invalid={fieldError("from") ? true : undefined}
              style={FIELD_STYLE}
            />
          </TextField>
          <TextField id="venue-search-to" label="To" error={fieldError("to")}>
            <input
              id="venue-search-to"
              type="datetime-local"
              value={form.to}
              onChange={(e) => set({ to: e.currentTarget.value })}
              aria-invalid={fieldError("to") ? true : undefined}
              style={FIELD_STYLE}
            />
          </TextField>
        </div>

        <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
          <CheckGroup
            legend="Facilities"
            names={withSelected(options.facilities, form.facilities)}
            selected={form.facilities}
            onToggle={(name, on) => toggle("facilities", name, on)}
          />
          <CheckGroup
            legend="Accessibility features"
            names={withSelected(options.accessibilityFeatures, form.accessibility)}
            selected={form.accessibility}
            onToggle={(name, on) => toggle("accessibility", name, on)}
          />
        </div>

        {unmatched.length > 0 && (
          <SectionMessage appearance="information" title="Not matched to a catalogue feature">
            <p>
              The event also asks for {unmatched.join(", ")}. No venue records {unmatched.length === 1 ? "that" : "those"} as an
              accessibility feature, so {unmatched.length === 1 ? "it is" : "they are"} not used as a filter.
            </p>
          </SectionMessage>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <Button appearance="primary" type="submit" isDisabled={loading}>
            Search
          </Button>
          <Button appearance="subtle" onClick={clear} isDisabled={loading}>
            Clear filters
          </Button>
        </div>
      </form>

      {error && !hasFieldErrors ? <Refusal error={error} /> : null}
      {error && hasFieldErrors ? (
        <SectionMessage appearance="error" title="The venues could not be searched">
          <p>{(error as ApiError).envelope.message}</p>
        </SectionMessage>
      ) : null}

      {result && <Results result={result} loading={loading} />}
    </div>
  );
}

function Results({ result, loading }: { result: VenueSearchResult; loading: boolean }) {
  const byLayout = result.filters.layout !== null;
  const head = {
    cells: [
      { key: "name", content: "Name" },
      { key: "building", content: "Building / location" },
      { key: "capacity", content: "Maximum capacity" },
      ...(byLayout ? [{ key: "layoutCapacity", content: `Capacity in ${result.filters.layout}` }] : []),
      { key: "facilities", content: "Facilities" },
      { key: "actions", content: "" },
    ],
  };
  const rows = result.items.map((venue) => ({
    key: venue.id,
    cells: [
      { key: "name", content: <Link to={`/venues/${venue.id}`}>{venue.name}</Link> },
      { key: "building", content: venue.building },
      { key: "capacity", content: String(venue.maxCapacity) },
      ...(byLayout ? [{ key: "layoutCapacity", content: String(venue.layoutCapacity ?? "") }] : []),
      { key: "facilities", content: venue.facilities.join(", ") },
      { key: "actions", content: <Link to={`/venues/${venue.id}/availability`}>Availability</Link> },
    ],
  }));

  return (
    <section aria-label="Results" aria-busy={loading}>
      {result.message ? (
        <SectionMessage appearance="information" title="No venues match">
          <p>{result.message}</p>
        </SectionMessage>
      ) : (
        <>
          <p aria-live="polite">
            {result.items.length === 1 ? "1 venue" : `${result.items.length} venues`}
            {result.appliedFilters.length > 0 ? ` match ${result.appliedFilters.join("; ")}.` : "."}
          </p>
          <DynamicTable head={head} rows={rows} isLoading={loading} />
        </>
      )}
    </section>
  );
}

function TextField(props: { id: string; label: string; error?: string; children: ReactNode }) {
  return (
    <div style={{ minWidth: 200 }}>
      <label htmlFor={props.id} style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {props.label}
      </label>
      {props.children}
      {props.error && (
        <div id={`${props.id}-error`} role="alert" style={{ color: "#AE2A19", fontSize: 12, marginTop: 4, maxWidth: 260 }}>
          {props.error}
        </div>
      )}
    </div>
  );
}

function CheckGroup(props: {
  legend: string;
  names: string[];
  selected: string[];
  onToggle: (name: string, on: boolean) => void;
}) {
  return (
    <fieldset style={{ border: "none", padding: 0, margin: 0, minWidth: 220 }}>
      <legend style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, padding: 0 }}>{props.legend}</legend>
      {props.names.length === 0 ? (
        <span style={{ fontSize: 13, color: "#626F86" }}>No venue records any yet.</span>
      ) : (
        props.names.map((name) => (
          <Checkbox
            key={name}
            label={name}
            isChecked={props.selected.includes(name)}
            onChange={(e) => props.onToggle(name, e.currentTarget.checked)}
          />
        ))
      )}
    </fieldset>
  );
}
