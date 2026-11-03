import type { CSSProperties, ReactNode } from "react";
import Lozenge from "@atlaskit/lozenge";
import SectionMessage from "@atlaskit/section-message";
import { ApiError } from "../api/client.js";
import type { PublicVenue } from "../api/registration.js";
import { formatMoment, formatPeriod } from "../shared/singaporeTime.js";

/**
 * implementation.md §7.2: the attendee surface's building blocks. Single
 * column, generous spacing on an 8px scale, one accent colour, and the
 * server's own words for every refusal. Times are Singapore's.
 */

export const ATTENDEE_ACCENT = "#0C66E4";
export const space = (n: number) => n * 8;

export const card: CSSProperties = {
  border: "1px solid #DCDFE4",
  borderRadius: space(1),
  padding: space(2),
  background: "#FFFFFF",
};

/** The event's date and times: "Wednesday 16 December 2026, 14:00–18:00". */
export function When({ startsAt, endsAt }: { startsAt: string | null; endsAt: string | null }) {
  if (!startsAt) return null;
  return <p style={{ margin: `${space(1)}px 0` }}>{formatPeriod(startsAt, endsAt)}</p>;
}

/** Each venue on its own line, with its location (R1, CR-03). */
export function Venues({ venues }: { venues: PublicVenue[] }) {
  if (venues.length === 0) return null;
  return (
    <ul aria-label="Venues" style={{ listStyle: "none", padding: 0, margin: `${space(1)}px 0` }}>
      {venues.map((venue, i) => (
        <li key={`${venue.name}-${i}`}>{venue.location ? `${venue.name} — ${venue.location}` : venue.name}</li>
      ))}
    </ul>
  );
}

/** R1: places remaining, or a Full label when there are none. */
export function Places({ placesRemaining, isFull }: { placesRemaining: number; isFull: boolean }) {
  if (isFull) return <Lozenge appearance="removed">Full</Lozenge>;
  return <strong>{placesRemaining === 1 ? "1 place remaining" : `${placesRemaining} places remaining`}</strong>;
}

/** The window and the withdrawal deadline, so the attendee knows the terms before registering (R2, R4). */
export function Terms(props: { registrationOpensAt: string | null; registrationClosesAt: string | null; withdrawalDeadline: string | null }) {
  return (
    <div style={{ color: "#44546F", margin: `${space(1)}px 0` }}>
      {props.registrationOpensAt && props.registrationClosesAt && (
        <p style={{ margin: 0 }}>
          Registration is open from {formatMoment(props.registrationOpensAt)} to {formatMoment(props.registrationClosesAt)}.
        </p>
      )}
      {props.withdrawalDeadline && <p style={{ margin: 0 }}>You can withdraw until {formatMoment(props.withdrawalDeadline)}.</p>}
    </div>
  );
}

/** A refusal in the server's own words (§7.1), titled for an attendee rather than with an error code. */
export function AttendeeRefusal({ error, title, children }: { error: unknown; title: string; children?: ReactNode }) {
  if (!error) return null;
  const message = error instanceof ApiError ? error.envelope.message : error instanceof Error ? error.message : String(error);
  return (
    <SectionMessage appearance="error" title={title}>
      <p>{message}</p>
      {children}
    </SectionMessage>
  );
}

export const page: CSSProperties = { display: "flex", flexDirection: "column", gap: space(2) };
