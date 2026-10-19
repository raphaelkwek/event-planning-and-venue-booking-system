import { request } from "./client.js";

/** P2 — inventory maintenance, served by planning-core's equipment module. */

const EQUIPMENT = "/equipment/api/v1";

export type EquipmentKind = "BULK" | "SERIALIZED";

export interface EquipmentTypeInput {
  name: string;
  description: string;
  characteristics: Record<string, string>;
  kind: EquipmentKind;
  totalQuantity: number | null;
  unitLabels: string[];
}

export interface EquipmentUnit {
  id: string;
  label: string;
}

export interface InventoryHistoryEntry {
  id: string;
  action: "TYPE_CREATED" | "TYPE_UPDATED" | "UNAVAILABILITY_RECORDED";
  previousQuantity: number;
  newQuantity: number;
  changes: Record<string, unknown>;
  actorUserId: string;
  actorRole: string;
  occurredAt: string;
}

export interface EquipmentType extends Omit<EquipmentTypeInput, "totalQuantity"> {
  id: string;
  /** Stored for bulk equipment and derived from active unit rows for serialized equipment. */
  totalQuantity: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
  unavailability: EquipmentUnavailability[];
  units: EquipmentUnit[];
  history: InventoryHistoryEntry[];
}

export interface EquipmentTypeListItem {
  id: string;
  name: string;
  description: string;
  kind: EquipmentKind;
  totalQuantity: number;
}

export interface EquipmentUnavailabilityInput {
  unitId: string | null;
  quantity: number | null;
  startsAt: string;
  endsAt: string;
  reason: string;
}

export interface EquipmentUnavailability extends EquipmentUnavailabilityInput {
  id: string;
  status: "ACTIVE" | "REMOVED";
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
  updatedBy: string | null;
}

export interface EquipmentTypeForm {
  name: string;
  description: string;
  characteristics: string;
  kind: EquipmentKind;
  totalQuantity: string;
  unitLabels: string;
}

export function emptyEquipmentTypeForm(): EquipmentTypeForm {
  return { name: "", description: "", characteristics: "", kind: "BULK", totalQuantity: "0", unitLabels: "" };
}

/** One `name: value` pair per line keeps arbitrary technical characteristics editable. */
export function toEquipmentTypeInput(form: EquipmentTypeForm): EquipmentTypeInput {
  return {
    name: form.name,
    description: form.description,
    characteristics: Object.fromEntries(
      form.characteristics
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((line) => {
          const colon = line.indexOf(":");
          return colon < 0 ? [line, ""] : [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
        }),
    ),
    kind: form.kind,
    totalQuantity: form.kind === "BULK" ? finiteNumber(form.totalQuantity) : null,
    unitLabels: form.kind === "SERIALIZED" ? lines(form.unitLabels) : [],
  };
}

export function fromEquipmentType(type: EquipmentTypeInput): EquipmentTypeForm {
  return {
    name: type.name,
    description: type.description,
    characteristics: Object.entries(type.characteristics)
      .map(([name, value]) => `${name}: ${value}`)
      .join("\n"),
    kind: type.kind,
    totalQuantity: type.totalQuantity === null ? "" : String(type.totalQuantity),
    unitLabels: linesFromType(type),
  };
}

const lines = (value: string) => value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);

function linesFromType(type: EquipmentTypeInput): string {
  if ("units" in type && Array.isArray((type as EquipmentType).units)) {
    return (type as EquipmentType).units.map((unit) => unit.label).join("\n");
  }
  return type.unitLabels.join("\n");
}

/** Preserve invalid input as null so the API can return the shared field-level refusal. */
export function finiteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

/** Convert a datetime-local value to the API's RFC 3339 UTC timestamp; preserve blanks for field validation. */
export function toInstant(value: string): string {
  if (!value.trim()) return "";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toISOString();
}

export function listEquipmentTypes(token: string) {
  return request<{ items: EquipmentTypeListItem[]; nextCursor?: string | null }>(`${EQUIPMENT}/equipment/types`, { token });
}

export function getEquipmentType(token: string, id: string) {
  return request<EquipmentType>(`${EQUIPMENT}/equipment/types/${id}`, { token });
}

export function createEquipmentType(token: string, body: EquipmentTypeInput) {
  return request<EquipmentType>(`${EQUIPMENT}/equipment/types`, { method: "POST", token, body });
}

export function updateEquipmentType(token: string, id: string, body: EquipmentTypeInput) {
  return request<EquipmentType>(`${EQUIPMENT}/equipment/types/${id}`, { method: "PUT", token, body });
}

export function addEquipmentUnavailability(token: string, id: string, body: EquipmentUnavailabilityInput) {
  return request<EquipmentUnavailability>(`${EQUIPMENT}/equipment/types/${id}/unavailability`, {
    method: "POST",
    token,
    body,
  });
}
