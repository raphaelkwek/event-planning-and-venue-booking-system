import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import { useSignedIn } from "../auth/SessionContext.js";
import { listRequests } from "../api/events.js";
import type { EventListItem } from "../api/types.js";
import {
  getVenue,
  getVenueSuitability,
  type SuitabilityCondition,
  type VenueSuitability as Assessment,
} from "../api/venues.js";
import { Refusal } from "../components/Refusal.js";
import { SUITABILITY_APPEARANCE, SUITABILITY_LABELS } from "../shared/status.js";

/**
 * K1 — whether this venue suits an event, and why not. The coordinator chooses
 * the event and nothing else: every value compared is read from the event record
 * and the venue catalogue on the server (AC4). The result is advisory (AC5):
 * this screen has no action that creates, changes or blocks a booking. Only
 * Event Coordinators reach it; the server refuses everyone else.
 */
export function VenueSuitability() {
  const session = useSignedIn();
  const navigate = useNavigate();
  const { id } = useParams();
  const [venueName, setVenueName] = useState<string | null>(null);
  const [events, setEvents] = useState<EventListItem[]>([]);
  const [eventId, setEventId] = useState("");
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getVenue(session.token, id!)
      .then((venue) => setVenueName(venue.name))
      .catch(setError);
    // Drafts belong to their owners; only submitted events have a record to assess.
    listRequests(session.token)
      .then((page) => setEvents(page.items.filter((item) => item.kind === "EVENT")))
      .catch(setError);
  }, [session.token, id]);

  function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAssessment(null);
    getVenueSuitability(session.token, id!, eventId)
      .then(setAssessment)
      .catch(setError)
      .finally(() => setLoading(false));
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <h2>{venueName ?? "Venue"}</h2>
      <p style={{ marginTop: 0 }}>Suitability for an event. This is advice only: it books nothing and blocks nothing.</p>

      <form onSubmit={submit} style={{ display: "flex", gap: 16, alignItems: "flex-end", flexWrap: "wrap", margin: "16px 0" }}>
        <div>
          <label htmlFor="suitability-event" style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            Event
          </label>
          <select
            id="suitability-event"
            value={eventId}
            onChange={(e) => setEventId(e.currentTarget.value)}
            style={{ padding: "6px 8px", border: "2px solid #DFE1E6", borderRadius: 3, font: "inherit", minWidth: 280 }}
          >
            <option value="">Choose an event</option>
            {events.map((item) => (
              <option key={item.id} value={item.id}>
                {item.reference ? `${item.reference} · ${item.name}` : item.name}
              </option>
            ))}
          </select>
        </div>
        <Button appearance="primary" type="submit" isDisabled={loading || !eventId}>
          Check suitability
        </Button>
      </form>

      {error ? <Refusal error={error} /> : null}

      {assessment && <Result assessment={assessment} />}

      <p>
        <Button appearance="subtle" onClick={() => navigate(`/venues/${id}`)}>
          Back to venue
        </Button>
      </p>
    </div>
  );
}

function Result({ assessment }: { assessment: Assessment }) {
  return (
    <section aria-labelledby="suitability-result" style={{ margin: "16px 0" }}>
      <h3 id="suitability-result" style={{ fontSize: 14, marginBottom: 8 }}>
        {assessment.venueName} for {assessment.eventReference ?? "the event"}
      </h3>
      <p role="status" style={{ margin: "0 0 12px" }}>
        <Lozenge appearance={SUITABILITY_APPEARANCE[assessment.status]} isBold>
          {SUITABILITY_LABELS[assessment.status]}
        </Lozenge>
      </p>
      <Conditions title="Reasons" conditions={assessment.reasons} />
      <Conditions title="Warnings" conditions={assessment.warnings} />
    </section>
  );
}

/** One list item per condition, in the server's own words with the values it compared. */
function Conditions({ title, conditions }: { title: string; conditions: SuitabilityCondition[] }) {
  if (conditions.length === 0) return null;
  const headingId = `suitability-${title.toLowerCase()}`;
  return (
    <>
      <h4 id={headingId} style={{ fontSize: 12, margin: "8px 0 4px" }}>
        {title}
      </h4>
      <ul aria-labelledby={headingId} style={{ margin: 0 }}>
        {conditions.map((condition) => (
          <li key={condition.condition}>{condition.message}</li>
        ))}
      </ul>
    </>
  );
}
