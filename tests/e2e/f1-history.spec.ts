import type { Page } from "@playwright/test";
import { ACCOUNTS } from "./support/accounts.js";
import { expect, signIn, signOut, test } from "./support/fixtures.js";
import { assignedRequest, query, rowWith, sideStatus } from "./support/seed-events.js";
import { safetyReviewEvent } from "./support/seed-lifecycle.js";

/**
 * F1's history cards that end on the Supabase SQL editor (F1-T6, F1-T12): the steps are done through
 * the screens, and the cards' queries run, unchanged, against the job's throwaway database.
 */

interface HistoryRow extends Record<string, unknown> {
  previous_status: string;
  new_status: string;
  actor_user_id: string;
  actor_role: string;
  triggering_action: string;
  occurred_at: Date | null;
}

const HISTORY = `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at
                   from event.event_history where event_id = $1 and entry_type = 'STATUS_CHANGE'`;

const statusOf = async (eventId: string) =>
  (await query<{ status: string }>("select status from event.events where id = $1", [eventId]))[0]?.status;

/** The newest status change (F1-T12's query 2). */
const latestStatusChange = async (eventId: string) =>
  (await query<HistoryRow>(`${HISTORY} order by occurred_at desc limit 1`, [eventId]))[0];

const statusPanel = (page: Page) => page.locator("aside").filter({ has: page.getByRole("heading", { name: "Status" }) });

test.describe("F1 every status change writes a history entry", () => {
  test("F1-T6 every status change on the way to Approved writes a full history entry", { tag: ["@F1", "@F1-T6"] }, async ({ page }) => {
    // FX-APPROVED: FX-SUBMITTED and FX-ASSIGNED (to Coordinator One) through the API; then the
    // coordinator's screen steps, "Review queue" → "Open" → "Approve".
    const request = await assignedRequest();
    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "Review queue" }).click();
    await rowWith(page, request.name).getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: request.name })).toBeVisible();
    await expect(sideStatus(page)).toHaveText("Under Review");
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page.getByText("This request is Approved")).toBeVisible();

    // Step 1: the card's query.
    const rows = await query<HistoryRow>(`${HISTORY} order by occurred_at`, [request.id]);
    const fields = (row: HistoryRow) => ({
      previous_status: row.previous_status,
      new_status: row.new_status,
      actor_user_id: row.actor_user_id,
      actor_role: row.actor_role,
      triggering_action: row.triggering_action,
    });
    expect(rows.map(fields)).toEqual([
      { previous_status: "DRAFT", new_status: "SUBMITTED", actor_user_id: ACCOUNTS.organiser.id, actor_role: "EVENT_ORGANISER", triggering_action: "SUBMIT" },
      { previous_status: "SUBMITTED", new_status: "UNDER_REVIEW", actor_user_id: ACCOUNTS.coordinator.id, actor_role: "EVENT_COORDINATOR", triggering_action: "OPEN_FOR_REVIEW" },
      { previous_status: "UNDER_REVIEW", new_status: "APPROVED", actor_user_id: ACCOUNTS.coordinator.id, actor_role: "EVENT_COORDINATOR", triggering_action: "APPROVE" },
    ]);
    for (const row of rows) expect(row.occurred_at).toBeInstanceOf(Date);
  });

  test("F1-T12 the Safety Officer's approval of a Safety Review event, then Mark Confirmed", { tag: ["@F1", "@F1-T12"] }, async ({ page }) => {
    // An event in Safety Review, reached through F5 (an approved event with a confirmed booking,
    // confirmed by Coordinator One), in place of FX-SEEDED, as F1-T13 does; its end is in March 2027.
    const { event } = await safetyReviewEvent(false);
    expect(await statusOf(event.id)).toBe("SAFETY_REVIEW");

    // Step 1: the Safety Officer records U1's approve decision from the Safety queue.
    await signIn(page, "safety");
    await page.getByRole("link", { name: "Safety queue", exact: true }).click();
    await page.getByRole("table", { name: "Events in Safety Review" }).getByRole("link", { name: event.reference }).click();
    await expect(page.getByRole("heading", { name: `${event.reference} · ${event.name}` })).toBeVisible();
    const form = page.getByRole("form", { name: "Safety decision" });
    await form.getByRole("radio", { name: /^Approve/ }).check();
    await form.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("A decision is recorded for this review")).toBeVisible();

    // Step 2: queries 1 and 2. Since Week 9 (W9-31, W9-61) the approval records the check as passed
    // and the event stays in Safety Review, with its own history entry.
    expect(await statusOf(event.id)).toBe("SAFETY_REVIEW");
    const approval = await latestStatusChange(event.id);
    expect(approval).toMatchObject({
      previous_status: "SAFETY_REVIEW",
      new_status: "SAFETY_REVIEW",
      actor_user_id: ACCOUNTS.safety.id,
      actor_role: "SAFETY_OFFICER",
      triggering_action: "APPROVE_SAFETY",
    });
    expect(approval?.occurred_at).toBeInstanceOf(Date);

    // U1's next step: the assigned coordinator marks the approved event Confirmed; queries 1 and 2 again.
    await signOut(page);
    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "All events" }).click();
    await rowWith(page, event.name).getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
    await page.getByRole("button", { name: "Mark Confirmed" }).click();
    await expect(statusPanel(page).getByText("Confirmed", { exact: true })).toBeVisible();

    expect(await statusOf(event.id)).toBe("CONFIRMED");
    const confirmed = await latestStatusChange(event.id);
    expect(confirmed).toMatchObject({
      previous_status: "SAFETY_REVIEW",
      new_status: "CONFIRMED",
      actor_user_id: ACCOUNTS.coordinator.id,
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "MARK_CONFIRMED",
    });
    expect(confirmed?.occurred_at).toBeInstanceOf(Date);
    expect(confirmed!.occurred_at!.getTime()).toBeGreaterThanOrEqual(approval!.occurred_at!.getTime());
  });
});
