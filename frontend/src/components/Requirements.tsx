import type { EquipmentRequirementLine, VenueRequirements } from "../api/types.js";

/**
 * B1, D1 — the venue and equipment requirements an organiser recorded, shown
 * read-only wherever the request is reviewed.
 */

const label = { fontSize: 12, fontWeight: 600, color: "#626F86" } as const;

export function VenueRequirementsView({ value }: { value: VenueRequirements | null }) {
  const facilities = value?.facilities ?? [];
  const empty = !value || (!value.layout && facilities.length === 0 && !value.notes);

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={label}>Venue requirements</div>
      {empty ? (
        <div>—</div>
      ) : (
        <div>
          <div>Room layout: {value!.layout || "—"}</div>
          <div>Facilities: {facilities.length > 0 ? facilities.join(", ") : "—"}</div>
          {value!.notes && <div>Notes: {value!.notes}</div>}
        </div>
      )}
    </div>
  );
}

export function EquipmentRequirementsView({
  required,
  lines,
}: {
  required: boolean | null;
  lines: EquipmentRequirementLine[] | null;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={label}>Equipment requirements</div>
      {!required ? (
        <div>None required</div>
      ) : !lines || lines.length === 0 ? (
        <div>Required, but no items listed</div>
      ) : (
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          {lines.map((line, index) => (
            <li key={index}>
              {line.quantity} × {line.equipmentType}
              {line.notes ? ` — ${line.notes}` : ""}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
