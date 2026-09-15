import type { Sql } from "postgres";

export interface UserRow {
  id: string;
  supabaseUserId: string;
  email: string;
  isActive: boolean;
}

export async function findUserBySupabaseId(sql: Sql, supabaseUserId: string): Promise<UserRow | null> {
  const rows = await sql<
    { id: string; supabase_user_id: string; email: string; is_active: boolean }[]
  >`
    select id, supabase_user_id, email, is_active
    from identity.users
    where supabase_user_id = ${supabaseUserId}
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    supabaseUserId: row.supabase_user_id,
    email: row.email,
    isActive: row.is_active,
  };
}

export async function findRoleForUser(sql: Sql, userId: string): Promise<string | null> {
  const rows = await sql<{ role: string }[]>`
    select role from identity.user_roles
    where user_id = ${userId}
    order by created_at asc
    limit 1
  `;
  return rows[0]?.role ?? null;
}

export async function recordSuccessfulLogin(sql: Sql, userId: string, occurredAt: Date): Promise<void> {
  await sql`
    update identity.users
    set last_login_at = ${occurredAt}, updated_at = now(), updated_by = ${userId}
    where id = ${userId}
  `;
}
