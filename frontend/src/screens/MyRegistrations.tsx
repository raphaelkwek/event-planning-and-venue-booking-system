import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTitle, ModalTransition } from "@atlaskit/modal-dialog";
import Spinner from "@atlaskit/spinner";
import { useSignedIn } from "../auth/SessionContext.js";
import { listMyRegistrations, withdrawRegistration, type RegistrationView } from "../api/registration.js";
import { AttendeeRefusal, card, page, space, When } from "../components/AttendeeParts.js";
import { formatMoment } from "../shared/singaporeTime.js";
import { REGISTRATION_STATUS_APPEARANCE, REGISTRATION_STATUS_LABELS } from "../shared/status.js";

/**
 * R3, R4 — every registration of the signed-in attendee, newest first: the
 * event's name, date and times, venue location, the status (Registered,
 * Withdrawn or Cancelled) and when it was registered and, where it was,
 * withdrawn. Withdraw confirms before acting (§7.2); a refusal stays in the
 * dialog in the server's words, and nothing changes.
 */
export function MyRegistrations() {
  const session = useSignedIn();
  const [items, setItems] = useState<RegistrationView[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [withdrawing, setWithdrawing] = useState<RegistrationView | null>(null);
  const [refusal, setRefusal] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

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
    </section>
  );
}
