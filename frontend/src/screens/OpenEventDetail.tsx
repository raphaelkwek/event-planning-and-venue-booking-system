import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { getOpenEvent, registerFor, type OpenEvent, type RegistrationView } from "../api/registration.js";
import { AttendeeRefusal, card, page, Places, space, Terms, Venues, When } from "../components/AttendeeParts.js";

/**
 * R1, R2 — one open event's published details, and Register: the screen's one
 * primary action (§7.2). A full event offers no Register action. A refusal is
 * shown in the server's words, naming its cause; for capacity it offers the
 * waitlist, which R6 opens. A high-demand event (EN-19) has no Register here:
 * its primary action is joining the waiting room, which registers the
 * attendee when their turn comes.
 */
export function OpenEventDetail() {
  const session = useSignedIn();
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<OpenEvent | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [registered, setRegistered] = useState<RegistrationView | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvent(await getOpenEvent(session.token, eventId!));
    } catch (e) {
      setLoadError(e);
    }
  }, [session.token, eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onRegister() {
    setBusy(true);
    setRefusal(null);
    try {
      setRegistered(await registerFor(session.token, eventId!));
    } catch (e) {
      setRefusal(e);
    } finally {
      setBusy(false);
      // Places remaining as it now stands, whichever way it went.
      await load();
    }
  }

  const needsWaitingRoom = refusal instanceof ApiError && (refusal.envelope.code === "ADMISSION_REQUIRED" || refusal.envelope.code === "ADMISSION_EXPIRED");
  const waitlistOffered = refusal instanceof ApiError && refusal.envelope.details?.waitlistOffered === true;

  return (
    <section aria-labelledby="event-heading" style={page}>
      <Link to="/open-events">Back to events</Link>
      <AttendeeRefusal error={loadError} title="This event is not open for registration" />
      {!event && !loadError && <Spinner label="Loading the event" />}
      {event && (
        <article style={card}>
          <h1 id="event-heading" style={{ margin: 0, fontSize: 24 }}>
            {event.name}
          </h1>
          {event.description && <p style={{ margin: `${space(1)}px 0` }}>{event.description}</p>}
          <When startsAt={event.startsAt} endsAt={event.endsAt} />
          <Venues venues={event.venues} />
          <Terms registrationOpensAt={event.registrationOpensAt} registrationClosesAt={event.registrationClosesAt} withdrawalDeadline={event.withdrawalDeadline} />
          <div style={{ display: "flex", flexDirection: "column", gap: space(2), marginTop: space(2) }}>
            <Places placesRemaining={event.placesRemaining} isFull={event.isFull} />
            {event.highDemand && !event.isFull && !registered && (
              <>
                <p style={{ margin: 0 }}>
                  This is a high-demand event. You join a queue and are registered automatically when it is your turn.
                </p>
                <Button appearance="primary" onClick={() => navigate(`/open-events/${event.eventId}/waiting-room`)} shouldFitContainer>
                  Join the waiting room
                </Button>
              </>
            )}
            {!event.highDemand && !event.isFull && !registered && (
              <Button appearance="primary" onClick={() => void onRegister()} isDisabled={busy} shouldFitContainer>
                Register
              </Button>
            )}
          </div>
        </article>
      )}
      {registered && (
        <SectionMessage appearance="success" title="You are registered">
          <p>
            Registration {registered.reference} for {registered.event.name} is confirmed.
          </p>
          <Link to="/my-registrations">My registrations</Link>
        </SectionMessage>
      )}
      <AttendeeRefusal error={refusal} title="You were not registered">
        {needsWaitingRoom && (
          <Button appearance="primary" onClick={() => navigate(`/open-events/${eventId}/waiting-room`)}>
            Join the waiting room
          </Button>
        )}
        {waitlistOffered && (
          <>
            <Button isDisabled>Join waitlist</Button>
            <p style={{ fontSize: 14 }}>Joining the waitlist is not available yet.</p>
          </>
        )}
      </AttendeeRefusal>
    </section>
  );
}
