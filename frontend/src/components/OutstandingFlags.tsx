import { useEffect, useState } from "react";
import Lozenge from "../shared/Lozenge.js";
import { useSignedIn } from "../auth/SessionContext.js";
import { ApiError } from "../api/client.js";
import { listArrangementFlags, type OutstandingFlag } from "../api/changeRequests.js";
import { ARRANGEMENT_LABELS, FLAG_LABELS } from "../shared/changeRequests.js";
import { Refusal } from "./Refusal.js";

/**
 * S3 — the flags still outstanding on an event's arrangements. The route says
 * who may see them (the owner, the assigned coordinator, Event Coordinators);
 * for anyone else it answers 404, and for an event with none the list is
 * empty. Either way the section is not shown. `refreshKey` reloads it after a
 * decision changes the flags.
 */
/**
 * D9 (staging dry run, 4 Nov 2026): a booking, hold or request is named by its reference and venue.
 * A reservation has no reference of its own (the route sends its id), so it is named by its equipment.
 */
function flagTitle(flag: OutstandingFlag): string {
  if (flag.arrangement === "EQUIPMENT") return `Equipment reservation, ${flag.name}`;
  return `${ARRANGEMENT_LABELS[flag.arrangement]} ${flag.reference}, ${flag.name}`;
}

export function OutstandingFlags({ eventId, refreshKey }: { eventId: string; refreshKey?: unknown }) {
  const session = useSignedIn();
  const [flags, setFlags] = useState<OutstandingFlag[] | null>(null);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    setError(null);
    listArrangementFlags(session.token, eventId)
      .then((result) => active && setFlags(Array.isArray(result.flags) ? result.flags : []))
      .catch((caught) => {
        if (!active) return;
        if (caught instanceof ApiError && caught.status === 404) setFlags([]);
        else setError(caught);
      });
    return () => {
      active = false;
    };
  }, [eventId, session.token, refreshKey]);

  if (!error && (flags === null || flags.length === 0)) return null;

  return (
    <section aria-labelledby="outstanding-flags-heading" style={{ marginTop: 32 }}>
      <h3 id="outstanding-flags-heading">Outstanding flags</h3>
      <Refusal error={error} />
      {flags && flags.length > 0 && (
        <ul style={{ paddingLeft: 0, listStyle: "none" }}>
          {flags.map((flag) => (
            <li
              key={`${flag.arrangement}-${flag.id}-${flag.flag}-${flag.flaggedAt}`}
              style={{ borderTop: "1px solid #DFE1E6", padding: "8px 0", fontSize: 13 }}
            >
              <strong>{flagTitle(flag)}</strong>{" "}
              <Lozenge appearance={flag.flag === "UNSUITABLE" ? "removed" : "moved"}>{FLAG_LABELS[flag.flag]}</Lozenge>
              <div>{flag.reason}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
