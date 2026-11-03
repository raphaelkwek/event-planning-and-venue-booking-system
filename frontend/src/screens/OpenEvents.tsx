import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Spinner from "@atlaskit/spinner";
import { useSignedIn } from "../auth/SessionContext.js";
import { listOpenEvents, type OpenEvent } from "../api/registration.js";
import { AttendeeRefusal, card, page, Places, space, Venues, When } from "../components/AttendeeParts.js";

/**
 * R1 — the events an attendee can register for, soonest first: name,
 * description, date and times, each venue with its location, and places
 * remaining or a Full label. Only what the registration service publishes is
 * shown; nothing internal reaches it.
 */
export function OpenEvents() {
  const session = useSignedIn();
  const [events, setEvents] = useState<OpenEvent[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    async (after: string | null) => {
      setError(null);
      try {
        const result = await listOpenEvents(session.token, after);
        setEvents((current) => [...(after ? (current ?? []) : []), ...result.items]);
        setCursor(result.nextCursor);
      } catch (e) {
        setError(e);
      }
    },
    [session.token],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <section aria-labelledby="open-events-heading" style={page}>
      <h1 id="open-events-heading" style={{ margin: 0 }}>
        Events
      </h1>
      <AttendeeRefusal error={error} title="The events could not be loaded" />
      {events === null && !error && <Spinner label="Loading events" />}
      {events !== null && events.length === 0 && <p>No events are open for registration right now.</p>}
      {events !== null && events.length > 0 && (
        <ul aria-label="Events open for registration" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: space(2) }}>
          {events.map((event) => (
            <li key={event.eventId}>
              <article style={card} aria-label={event.name}>
                <h2 style={{ margin: 0, fontSize: 20 }}>{event.name}</h2>
                {event.description && <p style={{ margin: `${space(1)}px 0` }}>{event.description}</p>}
                <When startsAt={event.startsAt} endsAt={event.endsAt} />
                <Venues venues={event.venues} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: space(1) }}>
                  <Places placesRemaining={event.placesRemaining} isFull={event.isFull} />
                  <Link to={`/open-events/${event.eventId}`}>View event</Link>
                </div>
              </article>
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <Button onClick={() => void load(cursor)} shouldFitContainer>
          Show more events
        </Button>
      )}
    </section>
  );
}
