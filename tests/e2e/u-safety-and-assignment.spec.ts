import type { Page } from "@playwright/test";
import { ACCOUNTS } from "./support/accounts.js";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { assign, submitRequest } from "./support/seed.js";
import { query, rowWith } from "./support/seed-events.js";
import { arrangedEvent, safetyReviewEvent } from "./support/seed-lifecycle.js";

/**
 * A4 (a coordinator sees only their own events; the Lead assigns and reassigns), U1 (the Safety
 * Officer's queue, review and decision, and Mark Confirmed) and the status-history rows F1 asks
 * for when the arrangements are confirmed and when the Safety Officer asks for changes, through
 * the real screens.
 */

const statusPanel = (page: Page) => page.locator("aside").filter({ has: page.getByRole("heading", { name: "Status" }) });

async function openFromAllEvents(page: Page, name: string) {
  await page.getByRole("link", { name: "All events" }).click();
  await rowWith(page, name).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name })).toBeVisible();
}

/** The Safety Officer opens an event's review from the queue. */
async function openReview(page: Page, reference: string, name: string) {
  await page.getByRole("link", { name: "Safety queue" }).click();
  await expect(page.getByRole("heading", { name: "Safety queue" })).toBeVisible();
  await page.getByRole("table", { name: "Events in Safety Review" }).getByRole("link", { name: reference }).click();
  await expect(page.getByRole("heading", { name: `${reference} · ${name}` })).toBeVisible();
}

interface HistoryRow extends Record<string, unknown> {
  previous_status: string;
  new_status: string;
  actor_user_id: string;
  actor_role: string;
  triggering_action: string;
  occurred_at: Date | null;
}

/** The newest status change in the event's history (the cards' "Query 2"). */
async function latestStatusChange(eventId: string) {
  const rows = await query<HistoryRow>(
    `select previous_status, new_status, actor_user_id::text as actor_user_id, actor_role, triggering_action, occurred_at
       from event.event_history
      where event_id = $1 and entry_type = 'STATUS_CHANGE'
      order by occurred_at desc limit 1`,
    [eventId],
  );
  return rows[0];
}

async function statusOf(eventId: string) {
  const rows = await query<{ status: string }>("select status from event.events where id = $1", [eventId]);
  return rows[0]?.status;
}

test.describe("A4 coordinators see only their own events", () => {
  test("A4-T14 signed in, each coordinator sees only their own events, an old link shows not found, and the Lead sees the assignments", { tag: ["@A4", "@A4-T14"] }, async ({ page, a11y }) => {
    // Pre-conditions: three submitted requests; One to Coordinator One, Two to Coordinator Two, Three unassigned.
    const one = await submitRequest({ name: uniqueName("A4 One") });
    const two = await submitRequest({ name: uniqueName("A4 Two") });
    const three = await submitRequest({ name: uniqueName("A4 Three") });
    await assign(one.id, "coordinator");
    await assign(two.id, "coordinator2");

    // Step 1: Coordinator One's "All events" and "Review queue" show A4 One only.
    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "All events" }).click();
    await expect(page.getByRole("heading", { name: "All events" })).toBeVisible();
    await expect(rowWith(page, one.name)).toBeVisible();
    await expect(page.getByText(two.name)).toHaveCount(0);
    await expect(page.getByText(three.name)).toHaveCount(0);
    await a11y("coordinator all events");
    await page.getByRole("link", { name: "Review queue" }).click();
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
    await expect(rowWith(page, one.name)).toBeVisible();
    await expect(page.getByText(two.name)).toHaveCount(0);
    await expect(page.getByText(three.name)).toHaveCount(0);

    // Step 2: the old link to A4 Two shows "not found" and none of its detail.
    await page.goto(`/#/review/${two.id}`);
    await expect(page.getByText("No event with that reference is assigned to you.")).toBeVisible();
    await expect(page.getByText(two.name)).toHaveCount(0);
    await expect(page.getByText(two.reference)).toHaveCount(0);
    await expect(page.getByText("Status history")).toHaveCount(0);

    // Step 3: the Lead's navigation offers the Lead's functions only.
    await signOut(page);
    await signIn(page, "lead");
    const nav = page.getByRole("banner").getByRole("navigation");
    await expect(nav.getByRole("link")).toHaveText([/^Unassigned$/, /^Assignments$/, /^Notifications/, /^API console$/]);
    for (const absent of [
      "Review queue",
      "All events",
      "My requests",
      "New request",
      "Booking requests",
      "Hold requests",
      "Venues",
      "Find a venue",
      "Equipment",
      "Equipment availability",
      "Equipment requests",
    ]) {
      await expect(nav.getByRole("link", { name: absent, exact: true })).toHaveCount(0);
    }
    await nav.getByRole("link", { name: "Unassigned", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Unassigned requests" })).toBeVisible();
    await expect(rowWith(page, three.name)).toBeVisible();
    await a11y("unassigned requests");
    await nav.getByRole("link", { name: "Assignments", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Assignments", exact: true })).toBeVisible();
    await expect(rowWith(page, one.name)).toContainText("Coordinator One");
    await expect(rowWith(page, two.name)).toContainText("Coordinator Two");
    await a11y("assignments overview");

    // Step 4: reassign A4 One to Coordinator Two.
    await rowWith(page, one.name).getByRole("link", { name: one.reference }).click();
    await expect(page.getByRole("heading", { name: one.name })).toBeVisible();
    await page.getByLabel("New coordinator").selectOption(ACCOUNTS.coordinator2.id);
    await page.getByRole("button", { name: "Reassign" }).click();
    await expect(page.getByText("Reassigned to Coordinator Two. They are now the event's coordinator.")).toBeVisible();

    // Coordinator One, signed in again, sees none of the three events on either screen.
    await signOut(page);
    await signIn(page, "coordinator");
    for (const screen of ["All events", "Review queue"]) {
      await page.getByRole("link", { name: screen }).click();
      await expect(page.getByRole("heading", { name: screen })).toBeVisible();
      await page.reload();
      await expect(page.getByRole("heading", { name: screen })).toBeVisible();
      // The list is read from the server after the page loads: wait for that, or "none" would pass too early.
      await page.waitForLoadState("networkidle");
      for (const event of [one, two, three]) await expect(page.getByText(event.name)).toHaveCount(0);
    }
  });
});

test.describe("U1 the Safety Officer's queue, review and decision", () => {
  test("U1-T16 Safety Officer queue, review and decision in the browser", { tag: ["@U1", "@U1-T16"] }, async ({ page, a11y }) => {
    // Two events wait in Safety Review: the first for the "request changes" decision, the second to be approved.
    const first = await safetyReviewEvent();
    const second = await safetyReviewEvent();
    const reason = "Move the chairs away from the east exit.";

    // Step 1: the Safety Officer's navigation offers the Safety queue.
    await signIn(page, "safety");
    await expect(page.getByRole("banner").getByRole("link", { name: "Safety queue" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Safety queue" })).toBeVisible();

    // Step 2: the queue lists both; E1's review shows the factors; a decision to request changes needs a reason.
    const queue = page.getByRole("table", { name: "Events in Safety Review" });
    await expect(queue.getByRole("row").filter({ hasText: first.event.name })).toContainText("Awaiting your decision");
    await expect(queue.getByRole("row").filter({ hasText: second.event.name })).toContainText("Awaiting your decision");
    await a11y("safety queue");
    await openReview(page, first.event.reference, first.event.name);

    const factors = page.getByLabel("Safety factors");
    await expect(factors).toContainText("150");
    await expect(factors).toContainText("Step-free access to the stage");
    const venues = page.getByRole("table", { name: "Booked venues" });
    await expect(venues).toContainText(first.venue.name);
    await expect(venues).toContainText("Theatre");
    await expect(venues).toContainText("Theatre (300), Classroom (120), Banquet (180)");
    const equipment = page.getByRole("table", { name: "Equipment and placement" });
    await expect(equipment).toContainText(first.chairs!.name);
    await expect(equipment).toContainText("Rows along the north wall");
    await a11y("safety review");

    const form = page.getByRole("form", { name: "Safety decision" });
    await form.getByRole("radio", { name: /Request changes/ }).check();
    await form.getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Give a reason when you request changes or reject the safety arrangement." })).toBeVisible();
    expect(await statusOf(first.event.id)).toBe("SAFETY_REVIEW");
    await form.getByLabel("Reason (required)").fill(reason);
    await form.getByRole("button", { name: "Record decision" }).click();
    await expect.poll(() => statusOf(first.event.id)).toBe("PLANNING");
    const decision = await query<{ decision: string; reason: string }>(
      "select decision, reason from event.safety_decisions where event_id = $1",
      [first.event.id],
    );
    expect(decision).toEqual([{ decision: "REQUEST_CHANGES", reason }]);

    // The event has left Safety Review, so it has left the queue; the other still waits.
    await page.getByRole("link", { name: "Safety queue" }).click();
    await expect(page.getByRole("table", { name: "Events in Safety Review" }).getByRole("row").filter({ hasText: second.event.name })).toBeVisible();
    await expect(page.getByText(first.event.name)).toHaveCount(0);

    // Step 3: the assigned coordinator's Mark Confirmed shows the server's refusal until the Safety Officer approves.
    await signOut(page);
    await signIn(page, "coordinator");
    await openFromAllEvents(page, first.event.name);
    await expect(statusPanel(page).getByText("Planning", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Confirmed" })).toHaveCount(0);
    await openFromAllEvents(page, second.event.name);
    await expect(statusPanel(page).getByText("Safety Review", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Mark Confirmed" }).click();
    await expect(
      page.getByText("The Safety Officer has not approved this event's safety arrangements, so it cannot be marked Confirmed."),
    ).toBeVisible();
    await expect(statusPanel(page).getByText("Safety Review", { exact: true })).toBeVisible();
    await a11y("coordinator review detail, Mark Confirmed refused");

    // Another coordinator is not offered the button at all.
    await signOut(page);
    await signIn(page, "coordinator2");
    await page.goto(`/#/review/${second.event.id}`);
    await expect(page.getByText("No event with that reference is assigned to you.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Confirmed" })).toHaveCount(0);

    // The Safety Officer approves the second event; its queue entry then reads "Approved, awaiting Mark Confirmed".
    await signOut(page);
    await signIn(page, "safety");
    await openReview(page, second.event.reference, second.event.name);
    await page.getByRole("form", { name: "Safety decision" }).getByRole("button", { name: "Record decision" }).click();
    await expect(page.getByText("A decision is recorded for this review")).toBeVisible();
    await page.getByRole("link", { name: "Safety queue" }).click();
    await expect(
      page.getByRole("table", { name: "Events in Safety Review" }).getByRole("row").filter({ hasText: second.event.name }),
    ).toContainText("Approved, awaiting Mark Confirmed");

    // Now Mark Confirmed works, and the event is Confirmed.
    await signOut(page);
    await signIn(page, "coordinator");
    await openFromAllEvents(page, second.event.name);
    await page.getByRole("button", { name: "Mark Confirmed" }).click();
    await expect(statusPanel(page).getByText("Confirmed", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mark Confirmed" })).toHaveCount(0);
    expect(await statusOf(second.event.id)).toBe("CONFIRMED");
  });
});

test.describe("F1 every status change writes a history entry", () => {
  test("F1-T7 confirming the arrangements writes a history entry from Approved to Safety Review", { tag: ["@F1", "@F1-T7"] }, async ({ page, a11y }) => {
    // An Approved event with its venue booking confirmed and no equipment required.
    const { event } = await arrangedEvent(false);
    expect(await statusOf(event.id)).toBe("APPROVED");

    // Step 1: the assigned coordinator confirms the arrangements through F5's action.
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);
    await page.getByRole("button", { name: "Confirm arrangements" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Confirm the venue and equipment arrangements?")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirm arrangements" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(statusPanel(page).getByText("Safety Review", { exact: true })).toBeVisible();
    await a11y("coordinator review detail, safety review");

    // Step 2: the newest status change reads APPROVED -> SAFETY_REVIEW by the coordinator.
    const row = await latestStatusChange(event.id);
    expect(row).toMatchObject({
      previous_status: "APPROVED",
      new_status: "SAFETY_REVIEW",
      actor_user_id: ACCOUNTS.coordinator.id,
      actor_role: "EVENT_COORDINATOR",
      triggering_action: "CONFIRM_ARRANGEMENTS",
    });
    expect(row?.occurred_at).toBeInstanceOf(Date);
  });

  test("F1-T13 a request for safety changes returns a Safety Review event to Planning", { tag: ["@F1", "@F1-T13"] }, async ({ page }) => {
    const { event } = await safetyReviewEvent(false);
    expect(await statusOf(event.id)).toBe("SAFETY_REVIEW");

    // Step 1: the Safety Officer records the "request changes" decision with the reason.
    await signIn(page, "safety");
    await openReview(page, event.reference, event.name);
    const form = page.getByRole("form", { name: "Safety decision" });
    await form.getByRole("radio", { name: /Request changes/ }).check();
    await form.getByLabel("Reason (required)").fill("Move the stage away from the fire exit.");
    await form.getByRole("button", { name: "Record decision" }).click();
    await expect.poll(() => statusOf(event.id)).toBe("PLANNING");

    // Step 2: the newest status change reads SAFETY_REVIEW -> PLANNING by the Safety Officer.
    const row = await latestStatusChange(event.id);
    expect(row).toMatchObject({
      previous_status: "SAFETY_REVIEW",
      new_status: "PLANNING",
      actor_user_id: ACCOUNTS.safety.id,
      actor_role: "SAFETY_OFFICER",
      triggering_action: "REQUEST_SAFETY_CHANGES",
    });
    expect(row?.occurred_at).toBeInstanceOf(Date);
  });
});
