import { useCallback, useEffect, useState } from "react";
import Button from "@atlaskit/button/new";
import SectionMessage from "@atlaskit/section-message";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { listHoldQueue, placeHold, reminderText, type Hold } from "../api/holds.js";
import { Refusal } from "../components/Refusal.js";
import { useUserNames } from "../shared/useUserNames.js";
import { formatMoment, formatPeriod, fromInputs, toInputs } from "../shared/singaporeTime.js";

/**
 * L3 — the holds coordinators have requested at the venues this Venue Staff
 * member looks after, soonest first. Following the customer's Week 9 answer,
 * Venue Staff place each one and set when it expires. Placing takes the
 * period, unless another hold or booking already has it.
 */

/** The expiry a row starts from: the day before the held period, at the same time. */
function suggestedExpiry(hold: Hold): { date: string; time: string } {
  return toInputs(new Date(Date.parse(hold.startsAt) - 24 * 60 * 60 * 1000).toISOString());
}

export function HoldQueue() {
  const session = useSignedIn();
  const [items, setItems] = useState<Hold[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const nameOf = useUserNames(session.token, items?.map((item) => item.requestedBy) ?? []);

  const load = useCallback(() => {
    listHoldQueue(session.token)
      .then((result) => setItems(result.items))
      .catch(setError);
  }, [session.token]);

  useEffect(load, [load]);

  if (error) return <Refusal error={error} />;
  if (!items) return <p>Loading…</p>;

  return (
    <div>
      <h2>Hold requests</h2>
      <p style={{ marginTop: 0, color: "#626F86" }}>
        Holds coordinators have asked for at the venues you look after. Place a hold to take its period, and set when it expires.
        Times are Singapore time.
      </p>
      {notice && (
        <div style={{ marginBottom: 16 }}>
          <SectionMessage appearance="success">
            <p style={{ margin: 0 }}>{notice}</p>
          </SectionMessage>
        </div>
      )}
      {items.length === 0 ? (
        <p>No hold request is waiting.</p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {["Reference", "Event", "Venue", "Date and time", "Requested by", "Reminder", "Expires", ""].map((heading, i) => (
                <th key={i} style={cell}>
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((hold) => (
              <Row
                key={hold.id}
                hold={hold}
                requester={nameOf(hold.requestedBy) ?? "—"}
                onPlaced={(placed) => {
                  setNotice(`${placed.reference} placed. It expires on ${formatMoment(placed.expiresAt!)}.`);
                  load();
                }}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Row({ hold, requester, onPlaced }: { hold: Hold; requester: string; onPlaced: (placed: Hold) => void }) {
  const session = useSignedIn();
  const [expiry, setExpiry] = useState(() => suggestedExpiry(hold));
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function place() {
    setBusy(true);
    setError(null);
    try {
      onPlaced(await placeHold(session.token, hold.id, fromInputs(expiry.date, expiry.time)));
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  }

  const fieldError = error instanceof ApiError ? error.fieldMessage("expiresAt") : undefined;
  const dateId = `expiry-date-${hold.id}`;
  const timeId = `expiry-time-${hold.id}`;

  return (
    <tr aria-label={hold.reference}>
      <td style={cell}>{hold.reference}</td>
      <td style={cell}>{hold.eventReference ?? "—"}</td>
      <td style={cell}>{hold.venueName}</td>
      <td style={cell}>{formatPeriod(hold.startsAt, hold.endsAt)}</td>
      <td style={cell}>{requester}</td>
      <td style={cell}>{reminderText(hold.reminderLeadMinutes)} before</td>
      <td style={cell}>
        <label htmlFor={dateId} style={hidden}>
          Expiry date for {hold.reference}
        </label>
        <input id={dateId} type="date" value={expiry.date} onChange={(e) => setExpiry({ ...expiry, date: e.currentTarget.value })} />{" "}
        <label htmlFor={timeId} style={hidden}>
          Expiry time for {hold.reference}
        </label>
        <input id={timeId} type="time" value={expiry.time} onChange={(e) => setExpiry({ ...expiry, time: e.currentTarget.value })} />
        {fieldError && (
          <div role="alert" style={{ color: "#AE2E24", fontSize: 12, marginTop: 4 }}>
            {fieldError}
          </div>
        )}
        {error && !fieldError ? <Refusal error={error} /> : null}
      </td>
      <td style={cell}>
        <Button appearance="primary" isDisabled={busy} onClick={() => void place()}>
          Place hold
        </Button>
      </td>
    </tr>
  );
}

const cell = { textAlign: "left" as const, padding: "6px 12px 6px 0", borderBottom: "1px solid #DFE1E6", verticalAlign: "top" as const };
const hidden = { position: "absolute" as const, width: 1, height: 1, overflow: "hidden", clip: "rect(0 0 0 0)" };
