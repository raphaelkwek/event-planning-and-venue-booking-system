import { request } from "./client.js";

/** Mirrors `userSummarySchema` in backend/packages/contracts. */
export interface UserSummary {
  id: string;
  displayName: string | null;
  email: string;
}

export async function lookupUsers(token: string, ids: string[]): Promise<UserSummary[]> {
  if (ids.length === 0) return [];
  const page = await request<{ items: UserSummary[] }>(
    `/identity/api/v1/users?ids=${ids.map(encodeURIComponent).join(",")}`,
    { token }
  );
  return page.items;
}
