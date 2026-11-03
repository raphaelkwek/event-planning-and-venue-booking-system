import { request } from "./client.js";

const EVENT = "/event/api/v1";

/** EN-15 — mirrors `GET /api/v1/feature-flags` in documentation/api/planning-core.openapi.yaml. */
export type FeatureFlags = Partial<Record<"change-approval", boolean>>;

export async function getFeatureFlags(token: string): Promise<FeatureFlags> {
  const body = await request<{ flags?: FeatureFlags }>(`${EVENT}/feature-flags`, { token });
  return body.flags ?? {};
}
