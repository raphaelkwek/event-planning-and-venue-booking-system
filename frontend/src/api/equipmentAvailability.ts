import { request } from "./client.js";

const EQUIPMENT = "/equipment/api/v1/equipment/types";

export interface EquipmentType {
  id: string;
  name: string;
  description: string;
  kind: "BULK" | "SERIALIZED";
  totalQuantity: number;
}

export interface EquipmentAvailability {
  equipmentTypeId: string;
  kind: EquipmentType["kind"];
  totalQuantity: number;
  availableQuantity: number;
  requestedQuantity: number;
  shortfallQuantity: number;
  startsAt: string;
  endsAt: string;
}

export function listEquipmentTypes(token: string) {
  return request<{ items: EquipmentType[]; nextCursor: null }>(EQUIPMENT, { token });
}

export function getEquipmentAvailability(
  token: string,
  id: string,
  window: { startsAt: string; endsAt: string; requestedQuantity: number },
) {
  const query = new URLSearchParams({
    startsAt: window.startsAt,
    endsAt: window.endsAt,
    requestedQuantity: String(window.requestedQuantity),
  });
  return request<EquipmentAvailability>(`${EQUIPMENT}/${encodeURIComponent(id)}/availability?${query}`, { token });
}
