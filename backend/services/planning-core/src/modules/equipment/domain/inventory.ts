import type { EquipmentKind, ErrorCode, ErrorField } from "@connectsphere/contracts";

/** P2's editable equipment-type record. Serialized totals are derived from active labels. */
export interface EquipmentTypeInput {
  name: string;
  description: string;
  characteristics: Record<string, string>;
  kind: EquipmentKind;
  totalQuantity: number | null;
  unitLabels: string[];
}

export type EquipmentTypeValidation =
  | { ok: true; equipmentType: EquipmentTypeInput }
  | { ok: false; fields: ErrorField[] };

const WHOLE_ZERO_OR_MORE = (value: number) => Number.isInteger(value) && value >= 0;

/** Validates, trims and de-duplicates the P2 type form without doing I/O. */
export function validateEquipmentType(input: EquipmentTypeInput): EquipmentTypeValidation {
  const fields: ErrorField[] = [];
  const name = input.name.trim();
  const description = input.description.trim();
  const characteristics = Object.fromEntries(
    Object.entries(input.characteristics).map(([key, value]) => [key.trim(), value.trim()]),
  );
  const unitLabels = input.unitLabels.map((label) => label.trim()).filter(Boolean);

  if (!name) fields.push({ field: "name", message: "Enter the equipment type's name." });
  if (!description) fields.push({ field: "description", message: "Enter a description." });
  for (const [key, value] of Object.entries(characteristics)) {
    if (!key) fields.push({ field: "characteristics", message: "Characteristic names cannot be blank." });
    if (!value) fields.push({ field: `characteristics.${key || "value"}`, message: "Enter a value for every characteristic." });
  }

  const duplicate = unitLabels.find((label, index) =>
    unitLabels.findIndex((candidate) => candidate.toLocaleLowerCase() === label.toLocaleLowerCase()) !== index,
  );
  if (duplicate) fields.push({ field: "unitLabels", message: `Record the unit label ${duplicate} only once.` });

  if (input.kind === "BULK") {
    if (input.totalQuantity === null || !WHOLE_ZERO_OR_MORE(input.totalQuantity)) {
      fields.push({ field: "totalQuantity", message: "Total quantity must be a whole number of zero or greater." });
    }
    if (input.unitLabels.length > 0) {
      fields.push({ field: "unitLabels", message: "Bulk equipment is counted by quantity and cannot have unit labels." });
    }
  } else {
    if (input.totalQuantity !== null) {
      fields.push({ field: "totalQuantity", message: "Serialized equipment quantity is calculated from its unit labels." });
    }
    if (unitLabels.length !== input.unitLabels.length) {
      fields.push({ field: "unitLabels", message: "Unit labels cannot be blank." });
    }
  }

  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, equipmentType: { ...input, name, description, characteristics, unitLabels } };
}

export interface UnavailabilityInput {
  unitId: string | null;
  quantity: number | null;
  startsAt: Date;
  endsAt: Date;
  reason: string;
}

export type UnavailabilityValidation =
  | { ok: true; unavailability: UnavailabilityInput }
  | { ok: false; fields: ErrorField[] };

/** P2's period and target rules. The API supplies real Date values after shape validation. */
export function validateUnavailability(input: UnavailabilityInput, kind: EquipmentKind): UnavailabilityValidation {
  const fields: ErrorField[] = [];
  const reason = input.reason.trim();
  if (!reason) fields.push({ field: "reason", message: "Enter why the equipment is unavailable." });
  if (input.endsAt.getTime() <= input.startsAt.getTime()) {
    fields.push({ field: "endsAt", message: "The end of the unavailable period must be later than the start." });
  }

  if (kind === "BULK") {
    if (input.unitId !== null) fields.push({ field: "unitId", message: "Bulk equipment is marked unavailable by quantity." });
    if (input.quantity === null || !Number.isInteger(input.quantity) || input.quantity <= 0) {
      fields.push({ field: "quantity", message: "Unavailable quantity must be a whole number greater than zero." });
    }
  } else {
    if (input.quantity !== null) fields.push({ field: "quantity", message: "A serialized unit is marked unavailable by unit id." });
    if (input.unitId === null) fields.push({ field: "unitId", message: "Choose the serialized unit that is unavailable." });
  }

  if (fields.length > 0) return { ok: false, fields };
  return { ok: true, unavailability: { ...input, reason } };
}

export interface AffectedReservation {
  eventReference: string;
  quantity: number;
}

/** P2 refusal: names every event whose active reservation prevents the reduction. */
export class InventoryReductionConflictError extends Error {
  readonly code = "INSUFFICIENT_EQUIPMENT" satisfies ErrorCode;

  constructor(
    readonly proposedQuantity: number,
    readonly affectedReservations: AffectedReservation[],
  ) {
    const affected = affectedReservations.map(({ eventReference, quantity }) => `${eventReference} (${quantity})`).join(", ");
    super(
      affected
        ? `Total quantity cannot be reduced to ${proposedQuantity}; affected reservations: ${affected}.`
        : `Total quantity cannot be reduced to ${proposedQuantity}; recorded unavailability would exceed that total.`,
    );
    this.name = "InventoryReductionConflictError";
  }
}

/** The requested quantity of bulk stock cannot exceed the total held. */
export class UnavailabilityExceedsTotalError extends Error {
  readonly code = "INSUFFICIENT_EQUIPMENT" satisfies ErrorCode;

  constructor(
    readonly requested: number,
    readonly totalQuantity: number,
  ) {
    super(`Cannot mark ${requested} unavailable because only ${totalQuantity} are held.`);
    this.name = "UnavailabilityExceedsTotalError";
  }
}
