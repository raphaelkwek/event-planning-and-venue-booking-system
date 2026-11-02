import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import {
  getOpenEvent,
  getWaitingRoomPlace,
  joinWaitingRoom,
  registerFor,
  type OpenEvent,
  type RegistrationView,
  type WaitingRoomPlace,
} from "../api/registration.js";
import { AttendeeRefusal, card, page, space } from "../components/AttendeeParts.js";

/**
 * EN-19 — the waiting room of a high-demand event (ADR-0011). The attendee
 * joins the queue, sees their position and the estimated wait, and the screen
 * asks for their place every couple of seconds until they are admitted. Then
 * it registers them with the admission token at once: the token is short-lived,
 * so waiting for a second click would waste it. A turn that passes unused
 * offers a new place at the back.
 */

export const POLL_MS = 2000;

/** "about 45 seconds", "about 3 minutes". */
export function waitText(seconds: number): string {
  if (seconds <= 0) return "no wait";
  if (seconds === 1) return "about 1 second";
  if (seconds < 60) return `about ${seconds} seconds`;
  const minutes = Math.ceil(seconds / 60);
  return minutes === 1 ? "about 1 minute" : `about ${minutes} minutes`;
}

export function WaitingRoom() {
  const session = useSignedIn();
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<OpenEvent | null>(null);
  const [place, setPlace] = useState<WaitingRoomPlace | null>(null);
  const [registered, setRegistered] = useState<RegistrationView | null>(null);
  const [problem, setProblem] = useState<unknown>(null);
  const [registerProblem, setRegisterProblem] = useState<unknown>(null);
  // Bumped to join again: after an expired turn, or to retry after a failed poll.
  const [round, setRound] = useState(0);

  useEffect(() => {
    // The event's name is a courtesy: the queue works without it.
    getOpenEvent(session.token, eventId!).then(setEvent, () => undefined);
  }, [session.token, eventId]);

  const queue = useCallback(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function register(admitted: WaitingRoomPlace) {
      try {
        const done = await registerFor(session.token, eventId!, admitted.admissionToken);
        if (!stopped) setRegistered(done);
      } catch (error) {
        if (!stopped) setRegisterProblem(error);
      }
    }

    async function step(entryId: string | null) {
      try {
        const next = entryId ? await getWaitingRoomPlace(session.token, entryId) : await joinWaitingRoom(session.token, eventId!);
        if (stopped) return;
        setPlace(next);
        if (next.status === "WAITING") timer = setTimeout(() => void step(next.entryId), POLL_MS);
        else if (next.status === "ADMITTED") await register(next);
      } catch (error) {
        if (!stopped) setProblem(error);
      }
    }

    void step(null);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [session.token, eventId]);

  useEffect(() => {
    setPlace(null);
    setProblem(null);
    setRegisterProblem(null);
    setRegistered(null);
    return queue();
  }, [queue, round]);

  const name = event ? event.name : "this event";
  const waiting = place?.status === "WAITING";
  const expired = place?.status === "EXPIRED" || (registerProblem instanceof ApiError && registerProblem.envelope.code === "ADMISSION_EXPIRED");

  return (
    <section aria-labelledby="waiting-heading" style={page}>
      <Link to={`/open-events/${eventId}`}>Back to the event</Link>
      <article style={card}>
        <h1 id="waiting-heading" style={{ margin: 0, fontSize: 24 }}>
          {waiting ? "You are in the queue" : registered ? "Registered" : expired ? "Your turn has passed" : "Waiting room"}
        </h1>
        <p style={{ margin: `${space(1)}px 0` }}>
          {name} is a high-demand event, so attendees are let in one at a time. Keep this page open: when it is your turn, you are registered
          automatically.
        </p>
        {!place && !problem && <Spinner label="Joining the queue" />}
        {waiting && place && (
          <div role="status" aria-live="polite" style={{ display: "flex", flexDirection: "column", gap: space(1) }}>
            <p style={{ margin: 0, fontSize: 20 }}>
              <strong>Your position: {place.position}</strong>
            </p>
            <p style={{ margin: 0 }}>Estimated wait: {waitText(place.estimatedWaitSeconds)}.</p>
          </div>
        )}
        {place?.status === "ADMITTED" && !registered && !registerProblem && <Spinner label="It is your turn. Registering you now" />}
      </article>
      {registered && (
        <SectionMessage appearance="success" title="You are registered">
          <p>
            Registration {registered.reference} for {registered.event.name} is confirmed.
          </p>
          <Link to="/my-registrations">My registrations</Link>
        </SectionMessage>
      )}
      {place?.status === "USED" && (
        <SectionMessage appearance="information" title="You have already used this turn">
          <p>Your place in the queue was used to register. Check your registrations.</p>
          <Link to="/my-registrations">My registrations</Link>
        </SectionMessage>
      )}
      <AttendeeRefusal error={registerProblem} title="You were not registered">
        {expired && <Button onClick={() => setRound((n) => n + 1)}>Join the queue again</Button>}
      </AttendeeRefusal>
      {place?.status === "EXPIRED" && !registerProblem && (
        <SectionMessage appearance="warning" title="Your turn has passed">
          <p>You were admitted, but did not register in time. Join the queue again for a new place.</p>
          <Button onClick={() => setRound((n) => n + 1)}>Join the queue again</Button>
        </SectionMessage>
      )}
      <AttendeeRefusal error={problem} title="The waiting room could not be reached">
        <Button onClick={() => setRound((n) => n + 1)}>Try again</Button>
      </AttendeeRefusal>
    </section>
  );
}
