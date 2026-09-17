import type { Sql } from "postgres";

export type LoginAuditOutcome = "SUCCESS" | "INVALID_CREDENTIALS" | "DEACTIVATED_ACCOUNT";

export async function insertLoginAudit(
  sql: Sql,
  params: { userId: string | null; emailTried: string; outcome: LoginAuditOutcome }
): Promise<void> {
  await sql`
    insert into identity.login_audit (user_id, email_tried, outcome)
    values (${params.userId}, ${params.emailTried}, ${params.outcome})
  `;
}
