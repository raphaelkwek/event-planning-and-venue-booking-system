import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
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
 * server's words, naming its cause. A high-demand event (EN-19) has no
 * Register here: its primary action is joining the waiting room, which
 * registers the attendee when their turn comes.
 */
export function OpenEventDetail() {
  const session = useSignedIn();
  const navigate = useNavigate();
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

  /**
   * D7 (staging dry run, 4 Nov 2026): the event's page is a browse listing a browser or CDN may keep
   * for a few seconds (EN-12), so a re-read just after registering can show the count from before.
   * A registration answers with the places remaining, and a refusal for capacity says none remain,
   * so the page shows those; any other outcome re-reads the event.
   */
  function showPlaces(placesRemaining: number) {
    setEvent((current) => (current ? { ...current, placesRemaining, isFull: placesRemaining === 0 } : current));
  }

  async function act(action: "register" | "join", run: () => Promise<number | null>) {
    setBusy(true);
    setRefusal(null);
    let places: number | null = null;
    try {
      places = await run();
      // An answer without the count (a join, or a service not yet sending it) re-reads the event.
      if (places === null) await load();
    } catch (error) {
      setRefusal({ error, action });
      // A refused registration names the count (none, for capacity); a refused join is left as R6 shows it.
      const reported = action === "register" && error instanceof ApiError ? error.envelope.details?.placesRemaining : undefined;
      if (typeof reported === "number") places = reported;
      // Places remaining as it now stands, then what the refusal said of it.
      await load();
    } finally {
      setBusy(false);
    }
    if (places !== null) showPlaces(places);
  }

  const onRegister = () =>
    act("register", async () => {
      const created = await registerFor(session.token, eventId!);
      setRegistered(created);
      return typeof created.placesRemaining === "number" ? created.placesRemaining : null;
    });
  const onJoin = () =>
    act("join", async () => {
      setWaitlisted(await joinWaitlist(session.token, eventId!));
      return null;
    });

  const needsWaitingRoom =
    refusal?.error instanceof ApiError && (refusal.error.envelope.code === "ADMISSION_REQUIRED" || refusal.error.envelope.code === "ADMISSION_EXPIRED");
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
            {event.highDemand && !event.isFull && !settled && (
              <>
                <p style={{ margin: 0 }}>
                  This is a high-demand event. You join a queue and are registered automatically when it is your turn.
                </p>
                <Button appearance="primary" onClick={() => navigate(`/open-events/${event.eventId}/waiting-room`)} shouldFitContainer>
                  Join the waiting room
                </Button>
              </>
            )}
            {!event.highDemand && !event.isFull && !settled && (
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
        {needsWaitingRoom && (
          <Button appearance="primary" onClick={() => navigate(`/open-events/${eventId}/waiting-room`)}>
            Join the waiting room
          </Button>
        )}
        {waitlistOffered && !settled && joinButton}
      </AttendeeRefusal>
    </section>
  );
}
