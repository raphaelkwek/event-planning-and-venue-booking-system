import Lozenge from "@atlaskit/lozenge";
import type { ChangeImpact, FlaggedArrangement } from "../api/changeRequests.js";
import { ARRANGEMENT_LABELS, FLAG_LABELS } from "../shared/changeRequests.js";
import { formatInstant } from "../shared/status.js";

/** S3 — the arrangements an approved change was assessed against (bookings, holds, booking requests, reservations), with any flag set on each. */
export function ChangeImpactView({ impact }: { impact: ChangeImpact }) {
  const flagsOf = (arrangement: FlaggedArrangement, id: string) =>
    impact.flags.filter((flag) => flag.arrangement === arrangement && flag.id === id);

  const empty = impact.bookings.length === 0 && impact.reservations.length === 0;
  const rows: { key: string; title: string; period: string; flags: ReturnType<typeof flagsOf> }[] = [
    ...impact.bookings.map((b) => ({
      key: `b-${b.id}`,
      title: `${ARRANGEMENT_LABELS[b.arrangement]} ${b.reference}, ${b.venueName}`,
      period: `${formatInstant(b.startsAt)} to ${formatInstant(b.endsAt)}`,
      flags: flagsOf(b.arrangement, b.id),
    })),
    ...impact.reservations.map((r) => ({
      key: `r-${r.id}`,
      title: `${r.equipmentTypeName}, quantity ${r.reservedQuantity}`,
      period: `${formatInstant(r.startsAt)} to ${formatInstant(r.endsAt)}`,
      flags: flagsOf("EQUIPMENT", r.id),
    })),
  ];

  return (
    <section aria-labelledby="change-impact-heading" style={{ marginBottom: 16 }}>
      <h3 id="change-impact-heading">Affected arrangements</h3>
      {empty && <p>No venue bookings or equipment reservations are affected.</p>}
      {rows.length > 0 && (
        <ul style={{ paddingLeft: 0, listStyle: "none" }}>
          {rows.map((row) => (
            <li key={row.key} style={{ border: "1px solid #DFE1E6", borderRadius: 4, padding: 12, marginBottom: 8 }}>
              <strong>{row.title}</strong>
              <div style={{ fontSize: 12, color: "#626F86" }}>{row.period}</div>
              {row.flags.map((flag) => (
                <div key={flag.flag} style={{ marginTop: 6 }}>
                  <Lozenge appearance={flag.flag === "UNSUITABLE" ? "removed" : "moved"}>{FLAG_LABELS[flag.flag]}</Lozenge>{" "}
                  <span style={{ fontSize: 13 }}>{flag.reason}</span>
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      <p>Registrations: {impact.activeRegistrations}</p>
    </section>
  );
}
