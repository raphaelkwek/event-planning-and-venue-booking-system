import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { getOpenEvent, joinWaitlist, registerFor, type OpenEvent, type RegistrationView, type WaitlistEntryView } from "../api/registration.js";
import { AttendeeRefusal, card, page, Places, space, Terms, Venues, When } from "../components/AttendeeParts.js";

/**
 * R1, R2, R6 — one open event's published details, and Register: the screen's
 * one primary action (§7.2). A full event offers no Register action but the
 * waitlist (R6), as a refusal for capacity does. A refusal is shown in the
 * server's words, naming its cause.
 */
export function OpenEventDetail() {
  const session = useSignedIn();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<OpenEvent | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [registered, setRegistered] = useState<RegistrationView | null>(null);
  const [waitlisted, setWaitlisted] = useState<WaitlistEntryView | null>(null);
  const [refusal, setRefusal] = useState<{ error: unknown; action: "register" | "join" } | null>(null);
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

  async function act(action: "register" | "join", run: () => Promise<void>) {
    setBusy(true);
    setRefusal(null);
    try {
      await run();
    } catch (error) {
      setRefusal({ error, action });
    } finally {
      setBusy(false);
      // Places remaining as it now stands, whichever way it went.
      await load();
    }
  }

  const onRegister = () => act("register", async () => setRegistered(await registerFor(session.token, eventId!)));
  const onJoin = () => act("join", async () => setWaitlisted(await joinWaitlist(session.token, eventId!)));

  const waitlistOffered = refusal?.error instanceof ApiError && refusal.error.envelope.details?.waitlistOffered === true;
  const settled = registered !== null || waitlisted !== null;
  const joinButton = (
    <Button appearance="primary" onClick={() => void onJoin()} isDisabled={busy} shouldFitContainer>
      Join the waitlist
    </Button>
  );

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
            {!event.isFull && !settled && (
              <Button appearance="primary" onClick={() => void onRegister()} isDisabled={busy} shouldFitContainer>
                Register
              </Button>
            )}
            {event.isFull && !settled && !waitlistOffered && (
              <>
                <p style={{ margin: 0 }}>No places remain. Join the waitlist and you will be told when one opens.</p>
                {joinButton}
              </>
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
      {waitlisted && (
        <SectionMessage appearance="success" title="You are on the waitlist">
          <p>
            {waitlisted.reference}: you are number {waitlisted.position} in line for {waitlisted.event.name}. When a place opens you will be told,
            and it goes to whoever registers first.
          </p>
          <Link to="/my-registrations">My registrations</Link>
        </SectionMessage>
      )}
      <AttendeeRefusal error={refusal?.error} title={refusal?.action === "join" ? "You were not added to the waitlist" : "You were not registered"}>
        {waitlistOffered && !settled && joinButton}
      </AttendeeRefusal>
    </section>
  );
}
