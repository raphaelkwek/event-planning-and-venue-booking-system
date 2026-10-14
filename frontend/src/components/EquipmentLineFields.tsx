import Textfield from "@atlaskit/textfield";
import TextArea from "@atlaskit/textarea";
import type { ApiError } from "../api/client.js";
import type { LineInput } from "../api/equipmentRequests.js";
import { finiteNumber, toInstant } from "../api/equipment.js";

/** O1 — one line of an equipment request as the coordinator is typing it. */
export interface LineDraft {
  key: string;
  equipmentTypeId: string;
  quantity: string;
  notes: string;
  /** datetime-local values, in the browser's time zone. */
  requiredFrom: string;
  requiredTo: string;
}

export interface TypeOption {
  id: string;
  name: string;
}

/** A datetime-local value for an instant, in the browser's time zone; blank when there is no instant. */
export function toInputValue(instant: string | null): string {
  if (!instant) return "";
  const date = new Date(instant);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** What the server is sent. Quantity and times pass through as typed, so the server's refusal names them. */
export function draftToInput(draft: LineDraft): LineInput {
  return {
    equipmentTypeId: draft.equipmentTypeId,
    quantity: finiteNumber(draft.quantity),
    notes: draft.notes,
    requiredFrom: toInstant(draft.requiredFrom) || null,
    requiredTo: toInstant(draft.requiredTo) || null,
  };
}

/** The refusal's message for one field of one line (`lines.2.quantity`, or `quantity` for an edit). */
export function fieldMessage(error: unknown, field: string): string | undefined {
  const envelope = (error as ApiError | null)?.envelope;
  return envelope?.fields?.find((entry) => entry.field === field)?.message;
}

interface Props {
  draft: LineDraft;
  types: TypeOption[];
  /** Makes the labels' ids unique when several lines are on screen. */
  idPrefix: string;
  /** The prefix the server puts on this line's field names. */
  errorPrefix: string;
  error: unknown;
  onChange: (changes: Partial<LineDraft>) => void;
}

/**
 * O1 — the fields of one equipment line: type, quantity, technical notes, required-from and
 * required-to. The server owns the rules and its refusal is shown beside the field it names.
 */
export function EquipmentLineFields({ draft, types, idPrefix, errorPrefix, error, onChange }: Props) {
  const problem = (field: string) => fieldMessage(error, `${errorPrefix}${field}`);
  const textField = (field: "quantity" | "requiredFrom" | "requiredTo", label: string, type: string) => (
    <div style={{ flex: 1, minWidth: 160 }}>
      <label htmlFor={`${idPrefix}-${field}`}>{label}</label>
      <Textfield
        id={`${idPrefix}-${field}`}
        type={type}
        value={draft[field]}
        min={field === "quantity" ? 1 : undefined}
        step={field === "quantity" ? 1 : undefined}
        isInvalid={Boolean(problem(field))}
        aria-invalid={Boolean(problem(field))}
        aria-describedby={problem(field) ? `${idPrefix}-${field}-error` : undefined}
        onChange={(event) => onChange({ [field]: event.currentTarget.value })}
      />
      {problem(field) && (
        <p id={`${idPrefix}-${field}-error`} style={{ color: "#AE2A19", margin: "4px 0 0" }}>
          {problem(field)}
        </p>
      )}
    </div>
  );

  return (
    <div style={{ border: "1px solid #DFE1E6", borderRadius: 4, padding: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <div style={{ flex: 2, minWidth: 220 }}>
          <label htmlFor={`${idPrefix}-type`}>Equipment type</label>
          <select
            id={`${idPrefix}-type`}
            value={draft.equipmentTypeId}
            aria-invalid={Boolean(problem("equipmentTypeId"))}
            aria-describedby={problem("equipmentTypeId") ? `${idPrefix}-type-error` : undefined}
            onChange={(event) => onChange({ equipmentTypeId: event.target.value })}
            style={{ display: "block", width: "100%", padding: 8 }}
          >
            <option value="">Select an equipment type</option>
            {types.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          {problem("equipmentTypeId") && (
            <p id={`${idPrefix}-type-error`} style={{ color: "#AE2A19", margin: "4px 0 0" }}>
              {problem("equipmentTypeId")}
            </p>
          )}
        </div>
        {textField("quantity", "Quantity", "number")}
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        {textField("requiredFrom", "Required from (local time)", "datetime-local")}
        {textField("requiredTo", "Required to (local time)", "datetime-local")}
      </div>
      <div style={{ marginTop: 12 }}>
        <label htmlFor={`${idPrefix}-notes`}>Technical requirements / notes</label>
        <TextArea
          id={`${idPrefix}-notes`}
          value={draft.notes}
          minimumRows={2}
          onChange={(event) => onChange({ notes: (event.target as HTMLTextAreaElement).value })}
        />
        {problem("notes") && <p style={{ color: "#AE2A19", margin: "4px 0 0" }}>{problem("notes")}</p>}
      </div>
    </div>
  );
}
