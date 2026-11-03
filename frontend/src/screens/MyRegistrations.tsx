import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import Spinner from "@atlaskit/spinner";
import { useSignedIn } from "../auth/SessionContext.js";
import {
  leaveWaitlist,
  listMyRegistrations,
  listMyWaitlist,
  withdrawRegistration,
  type RegistrationView,
  type WaitlistEntryView,
} from "../api/registration.js";
import { AttendeeRefusal, card, page, space, When } from "../components/AttendeeParts.js";
import { formatMoment } from "../shared/singaporeTime.js";
import { REGISTRATION_STATUS_APPEARANCE, REGISTRATION_STATUS_LABELS, WAITLIST_STATUS_APPEARANCE, WAITLIST_STATUS_LABELS } from "../shared/status.js";

/**
 * R3, R4 — every registration of the signed-in attendee, newest first: the
 * event's name, date and times, venue location, the status (Registered,
 * Withdrawn or Cancelled) and when it was registered and, where it was,
 * withdrawn. Withdraw confirms before acting (§7.2); a refusal stays in the
 * dialog in the server's words, and nothing changes.
 *
 * R6: below them, the attendee's waitlist entries, each with its place in line
 * while waiting, and Leave, which confirms first too.
 */
export function MyRegistrations() {
  const session = useSignedIn();
  const [items, setItems] = useState<RegistrationView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [withdrawing, setWithdrawing] = useState<RegistrationView | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [entries, setEntries] = useState<WaitlistEntryView[]>([]);
  const [leaving, setLeaving] = useState<WaitlistEntryView | null>(null);
  const [leaveRefusal, setLeaveRefusal] = useState<unknown>(null);

  const load = useCallback(
    async (after: string | null) => {
      try {
        const result = await listMyRegistrations(session.token, after);
        setItems((current) => [...(after ? (current ?? []) : []), ...result.items]);
        setCursor(result.nextCursor);
      } catch (e) {
        setLoadError(e);
      }
    },
    [session.token],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  useEffect(() => {
    listMyWaitlist(session.token).then(
      (page) => setEntries(page.items),
      // The registrations still show; the waitlist is left out rather than blocking them.
      () => setEntries([]),
    );
  }, [session.token]);

  function closeLeave() {
    setLeaving(null);
    setLeaveRefusal(null);
  }

  async function onLeave() {
    if (!leaving) return;
    setBusy(true);
    try {
      const left = await leaveWaitlist(session.token, leaving.id);
      setEntries((current) => current.map((e) => (e.id === left.id ? left : e)));
      closeLeave();
    } catch (e) {
      setLeaveRefusal(e);
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setWithdrawing(null);
    setRefusal(null);
  }

  async function onWithdraw() {
    if (!withdrawing) return;
    setBusy(true);
    try {
      const done = await withdrawRegistration(session.token, withdrawing.id);
      setItems((current) => (current ?? []).map((r) => (r.id === done.id ? done : r)));
      close();
    } catch (e) {
      setRefusal(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="mine-heading" style={page}>
      <h1 id="mine-heading" style={{ margin: 0 }}>
        My registrations
      </h1>
      <AttendeeRefusal error={loadError} title="Your registrations could not be loaded" />
      {items === null && !loadError && <Spinner label="Loading your registrations" />}
      {items !== null && items.length === 0 && (
        <p>
          You have no registrations yet. <Link to="/open-events">Events</Link>
        </p>
      )}
      {items !== null && items.length > 0 && (
        <ul aria-label="My registrations" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: space(2) }}>
          {items.map((r) => (
            <li key={r.id} style={card}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: space(1), flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: 18 }}>{r.event.name}</h2>
                <Lozenge appearance={REGISTRATION_STATUS_APPEARANCE[r.status]}>{REGISTRATION_STATUS_LABELS[r.status]}</Lozenge>
              </div>
              <When startsAt={r.event.startsAt} endsAt={r.event.endsAt} />
              {r.event.venues.length > 0 && (
                <p style={{ margin: `${space(1)}px 0` }}>{r.event.venues.map((v) => v.location ?? v.name).join(" · ")}</p>
              )}
              <p style={{ margin: 0, color: "#44546F" }}>
                {r.reference} · Registered {formatMoment(r.registeredAt)}
              </p>
              {r.withdrawnAt && <p style={{ margin: 0, color: "#44546F" }}>Withdrawn {formatMoment(r.withdrawnAt)}</p>}
              {r.cancelledAt && <p style={{ margin: 0, color: "#44546F" }}>Cancelled {formatMoment(r.cancelledAt)}, with the event</p>}
              {r.status === "REGISTERED" && (
                <div style={{ marginTop: space(2) }}>
                  <Button onClick={() => setWithdrawing(r)}>Withdraw</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {cursor && (
        <Button onClick={() => void load(cursor)} shouldFitContainer>
          Show more
        </Button>
      )}

      {entries.length > 0 && (
        <>
          <h2 style={{ margin: `${space(2)}px 0 0`, fontSize: 20 }}>Waitlist</h2>
          <ul aria-label="My waitlist entries" style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: space(2) }}>
            {entries.map((e) => (
              <li key={e.id} style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: space(1), flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{e.event.name}</h3>
                  <Lozenge appearance={WAITLIST_STATUS_APPEARANCE[e.status]}>{WAITLIST_STATUS_LABELS[e.status]}</Lozenge>
                </div>
                <When startsAt={e.event.startsAt} endsAt={e.event.endsAt} />
                <p style={{ margin: 0, color: "#44546F" }}>
                  {e.reference} · Joined {formatMoment(e.joinedAt)}
                  {e.position !== null && ` · Number ${e.position} in line`}
                </p>
                {e.lastNotifiedAt && e.status === "WAITLISTED" && (
                  <p style={{ margin: 0 }}>
                    A place opened on {formatMoment(e.lastNotifiedAt)}. <Link to={`/open-events/${e.event.eventId}`}>Register</Link> if one is still free.
                  </p>
                )}
                {e.withdrawnAt && <p style={{ margin: 0, color: "#44546F" }}>Left {formatMoment(e.withdrawnAt)}</p>}
                {e.registeredAt && <p style={{ margin: 0, color: "#44546F" }}>Registered {formatMoment(e.registeredAt)}</p>}
                {e.cancelledAt && <p style={{ margin: 0, color: "#44546F" }}>Cancelled {formatMoment(e.cancelledAt)}, with the event</p>}
                {e.status === "WAITLISTED" && (
                  <div style={{ marginTop: space(2) }}>
                    <Button onClick={() => setLeaving(e)}>Leave the waitlist</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      )}

      <ModalTransition>
        {withdrawing && (
          <Modal onClose={close} width="small">
            <ModalHeader>
              <ModalTitle>Withdraw your registration?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                Your place at {withdrawing.event.reference} “{withdrawing.event.name}” will be released for someone else, and registration{" "}
                {withdrawing.reference} will show as Withdrawn. You can register again while registration is open and places remain.
              </p>
              <AttendeeRefusal error={refusal} title="Your registration was not withdrawn" />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={close}>
                Keep my place
              </Button>
              <Button appearance="warning" onClick={() => void onWithdraw()} isDisabled={busy}>
                Withdraw registration
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>

      <ModalTransition>
        {leaving && (
          <Modal onClose={closeLeave} width="small">
            <ModalHeader>
              <ModalTitle>Leave the waitlist?</ModalTitle>
            </ModalHeader>
            <ModalBody>
              <p>
                You will no longer be told when a place opens at {leaving.event.reference} “{leaving.event.name}”. Entry {leaving.reference} will show as
                Left the waitlist.
              </p>
              <AttendeeRefusal error={leaveRefusal} title="You are still on the waitlist" />
            </ModalBody>
            <ModalFooter>
              <Button appearance="subtle" onClick={closeLeave}>
                Stay on it
              </Button>
              <Button appearance="warning" onClick={() => void onLeave()} isDisabled={busy}>
                Leave the waitlist
              </Button>
            </ModalFooter>
          </Modal>
        )}
      </ModalTransition>
    </section>
  );
}
