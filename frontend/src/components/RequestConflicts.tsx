import Lozenge from "@atlaskit/lozenge";
import type { RequestConflict } from "../api/bookingRequests.js";
import { formatPeriod } from "../shared/singaporeTime.js";

const KIND_LABELS: Record<RequestConflict["kind"], string> = {
  REQUEST: "pending request",
  BOOKING: "confirmed booking",
};

/**
 * N2: a pending request's clashes at its venue, each with its reference and
 * period. Informational: Venue Staff still decide, and nothing here acts.
 */
export function RequestConflicts({ conflicts }: { conflicts: readonly RequestConflict[] }) {
  if (conflicts.length === 0) return null;
  return (
    <div style={{ marginBottom: 4 }}>
      <Lozenge appearance="moved">Conflict</Lozenge>
      <ul style={{ margin: "4px 0 0", paddingLeft: 16, fontSize: 12 }}>
        {conflicts.map((c) => (
          <li key={`${c.kind}-${c.reference}`}>
            Conflicts with {c.reference} ({KIND_LABELS[c.kind]}), {formatPeriod(c.startsAt, c.endsAt)}
          </li>
        ))}
      </ul>
    </div>
  );
}
