import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Button from "@atlaskit/button/new";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import Spinner from "@atlaskit/spinner";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import {
  listEventRegistrations,
  listEventWaitlist,
  type EventRegistrations as Registrations,
  type EventWaitlist,
  type ManagedRegistration,
  type Person,
} from "../api/registration.js";
import { AddAttendee } from "../components/AddAttendee.js";
import { Refusal } from "../components/Refusal.js";
import { formatMoment } from "../shared/singaporeTime.js";
import { REGISTRATION_STATUS_APPEARANCE, REGISTRATION_STATUS_LABELS, WAITLIST_STATUS_APPEARANCE, WAITLIST_STATUS_LABELS } from "../shared/status.js";

/**
 * R5 to R7 — an event's registrations, for its owning organiser and assigned
 * coordinator: every registration with the attendee's name, its time and its
 * status, manual additions told apart, and the totals; adding an attendee by
 * hand, showing the capacity and the new total first (D-01); and the waitlist
 * in the order it was joined. Served by the registration service, which
 * answers anyone else as if the event did not exist.
 */

const cell = { padding: "6px 8px", borderBottom: "1px solid #DFE1E6", textAlign: "left" as const, verticalAlign: "top" as const };
const muted = { margin: 0, color: "#626F86" };

const personName = (p: Person) => p.name ?? p.email ?? "Name unavailable";
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function EventRegistrations() {
  const session = useSignedIn();
  const { id } = useParams<{ id: string }>();
  const [list, setList] = useState<Registrations | null>(null);
  const [waitlist, setWaitlist] = useState<EventWaitlist | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);

  const load = useCallback(async () => {
    try {
      const [registrations, entries] = await Promise.all([listEventRegistrations(session.token, id!), listEventWaitlist(session.token, id!)]);
      setList(registrations);
      setWaitlist(entries);
    } catch (e) {
      setLoadError(e);
    }
  }, [session.token, id]);

  useEffect(() => {
    void load();
  }, [load]);

  async function more() {
    if (!list?.nextCursor) return;
    const next = await listEventRegistrations(session.token, id!, list.nextCursor);
    setList({ ...next, items: [...list.items, ...next.items] });
  }

  if (loadError instanceof ApiError && loadError.status === 404) {
    return (
      <SectionMessage appearance="warning" title="This event's registrations are not available to you">
        <p>{loadError.envelope.message} Only the event's organiser and its assigned coordinator see who has registered.</p>
      </SectionMessage>
    );
  }
  if (loadError) return <Refusal error={loadError} />;
  if (!list || !waitlist) return <Spinner label="Loading the registrations" />;

  const { totals } = list;
  return (
    <section aria-labelledby="registrations-heading" style={{ maxWidth: 960 }}>
      <h1 id="registrations-heading" style={{ marginBottom: 4 }}>
        Registrations
      </h1>
      <p style={muted}>
        {list.event.reference} “{list.event.name}”{list.event.startsAt ? `, ${formatMoment(list.event.startsAt)}` : ""}
      </p>

      <ul aria-label="Totals" style={{ listStyle: "none", padding: 0, display: "flex", flexWrap: "wrap", gap: 24, margin: "16px 0" }}>
        <li>
          <strong>Registered {totals.registered}</strong>
        </li>
        <li>Withdrawn {totals.withdrawn}</li>
        <li>
          <strong>Places remaining {totals.placesRemaining}</strong>
        </li>
        <li>Capacity {totals.capacity}</li>
        {totals.manuallyAdded > 0 && <li>Added by hand {totals.manuallyAdded}</li>}
        {totals.overCapacityBy > 0 && (
          <li>
            <Lozenge appearance="moved">Over capacity by {totals.overCapacityBy}</Lozenge>
          </li>
        )}
        {totals.cancelled > 0 && <li>Cancelled {totals.cancelled}</li>}
      </ul>
      {!list.namesAvailable && (
        <SectionMessage appearance="warning" title="Names are unavailable">
          <p>The identity service couldn't be asked who these attendees are, so their names are missing. Reload to try again.</p>
        </SectionMessage>
      )}

      {list.items.length === 0 ? (
        <p>No one has registered yet.</p>
      ) : (
        <table aria-label="Registrations" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Attendee", "Registered", "Status", "How"].map((heading) => (
                <th key={heading} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.items.map((r) => (
              <RegistrationRow key={r.id} registration={r} />
            ))}
          </tbody>
        </table>
      )}
      {list.nextCursor && (
        <div style={{ marginTop: 12 }}>
          <Button onClick={() => void more()}>Show more</Button>
        </div>
      )}

      <AddAttendee eventId={list.event.eventId} capacity={totals.capacity} registered={totals.registered} onAdded={load} />

      <h2 style={{ marginTop: 32 }}>Waitlist</h2>
      <p style={muted}>
        {waitlist.waiting === 0 ? "No one is waiting." : `${count(waitlist.waiting, "attendee is", "attendees are")} waiting.`} Waitlist entries are not
        registrations and take no places. When a place opens, everyone waiting is told and the first to register gets it.
      </p>
      {waitlist.items.length > 0 && (
        <table aria-label="Waitlist" style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Position", "Attendee", "Joined", "Status", "Last told of a place"].map((heading) => (
                <th key={heading} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {waitlist.items.map((e) => (
              <tr key={e.id}>
                <td style={cell}>{e.position ?? "—"}</td>
                <td style={cell}>{personName(e.attendee)}</td>
                <td style={cell}>{formatMoment(e.joinedAt)}</td>
                <td style={cell}>
                  <Lozenge appearance={WAITLIST_STATUS_APPEARANCE[e.status]}>{WAITLIST_STATUS_LABELS[e.status]}</Lozenge>
                </td>
                <td style={cell}>{e.lastNotifiedAt ? formatMoment(e.lastNotifiedAt) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

/** One registration: who, when, its status, and whether they registered themselves or were added (R7). */
function RegistrationRow({ registration: r }: { registration: ManagedRegistration }) {
  return (
    <tr>
      <td style={cell}>
        {personName(r.attendee)}
        {r.attendee.email && r.attendee.name !== r.attendee.email && <p style={muted}>{r.attendee.email}</p>}
      </td>
      <td style={cell}>{formatMoment(r.registeredAt)}</td>
      <td style={cell}>
        <Lozenge appearance={REGISTRATION_STATUS_APPEARANCE[r.status]}>{REGISTRATION_STATUS_LABELS[r.status]}</Lozenge>
        {r.withdrawnAt && <p style={muted}>Withdrawn {formatMoment(r.withdrawnAt)}</p>}
        {r.cancelledAt && <p style={muted}>Cancelled {formatMoment(r.cancelledAt)}</p>}
      </td>
      <td style={cell}>
        {r.manualAddition ? (
          <>
            Added by {personName(r.manualAddition.addedBy)}
            {r.manualAddition.reason && <p style={muted}>“{r.manualAddition.reason}”</p>}
            {r.manualAddition.overCapacity && (
              <p style={{ margin: "4px 0 0" }}>
                <Lozenge appearance="moved">Over capacity</Lozenge>
              </p>
            )}
            {!r.holdsSeat && r.status === "REGISTERED" && <p style={muted}>Takes the next seat that is freed</p>}
          </>
        ) : (
          "Self-registered"
        )}
      </td>
    </tr>
  );
}
