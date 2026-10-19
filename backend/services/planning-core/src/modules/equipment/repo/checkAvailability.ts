import type { Sql, TransactionSql } from "postgres";
import type { EquipmentKind } from "@connectsphere/contracts";
import type { AvailabilityInput } from "../domain/checkAvailability.js";
import { availableQuantity, shortfall } from "../domain/availability.js";
import { availableUnits, lockEquipmentType, peakUse } from "./inventory.js";

export interface EquipmentCatalogueItem {
  id: string;
  name: string;
  description: string;
  kind: EquipmentKind;
  totalQuantity: number;
}
/** Read-only catalogue; serialized totals derive from the unit rows in EN-02.2. */
export async function listAvailabilityTypes(sql: Sql): Promise<EquipmentCatalogueItem[]> {
  const rows = await sql<{id: string; name: string; description: string; kind: EquipmentKind; total_quantity: number}[]>`
    select t.id, t.name, t.description, t.kind,
           case when t.kind = 'BULK' then t.total_quantity
                else (select count(*)::int from equipment.equipment_units u where u.equipment_type_id = t.id)
           end as total_quantity
      from equipment.equipment_types t order by lower(t.name), t.id
  `;
  return rows.map(({ total_quantity, ...row }) => ({ ...row, totalQuantity: total_quantity }));
}
/** A transaction holds the same type lock as reservations; the check never persists changes. */
export async function checkEquipmentAvailability(tx: TransactionSql, equipmentTypeId: string, input: AvailabilityInput) {
  const type = await lockEquipmentType(tx, equipmentTypeId);
  if (!type) return null;
  let totalQuantity: number;
  let available: number;
  if (type.kind === "BULK") {
    totalQuantity = type.totalQuantity!;
    available = availableQuantity(totalQuantity, await peakUse(tx, equipmentTypeId, input));
  } else {
    const [row] = await tx<{quantity: number}[]>`select count(*)::int as quantity from equipment.equipment_units where equipment_type_id = ${equipmentTypeId}`;
    totalQuantity = row!.quantity;
    available = (await availableUnits(tx, equipmentTypeId, input)).length;
  }
  return { equipmentTypeId, kind: type.kind, totalQuantity, availableQuantity: available,
    requestedQuantity: input.requestedQuantity, shortfallQuantity: shortfall(input.requestedQuantity, available),
    startsAt: input.startsAt.toISOString(), endsAt: input.endsAt.toISOString() };
}
