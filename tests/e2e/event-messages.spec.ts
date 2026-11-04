import type { Page } from "@playwright/test";
import { ACCOUNTS } from "./support/accounts.js";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import type { EventRow } from "./support/seed.js";
import {
  CARD_END_LOCAL,
  CARD_START_LOCAL,
  assignedRequest,
  awaitingRequest,
  query,
  rowWith,
  sideStatus,
  sideValue,
} from "./support/seed-events.js";

/**
 * The message each step of a request writes to event.outbox, from which the notification service
 * builds its notice (B1-T5, D2-T7, D3-T8, D4-T5, D4-T6, D5-T7, E1-T2). The cards end by running a
 * query in the Supabase SQL editor; here the same query runs against the job's throwaway database.
 * Kafka is off in this stack, so no relay publishes the outbox and every row stays unpublished.
 *
 * The step that writes the card's message is done through the screen; the fixture steps before it
 * go through the API as the user who would take them (tests/e2e/support/seed.ts), and FX-ASSIGNED
 * is the Lead's assignment there, so it writes the Lead's `event.coordinator-assigned` message.
 */

const REFERENCE = /^EVT-\d{6}$/;
const EVENT_TOPIC = "connectsphere.event.v1";

interface OutboxRow extends Record<string, unknown> {
  message_type: string;
}

/** FX-SUBMITTED through the screen: the standard request, typed in and submitted by the organiser. */
async function submitTheStandardRequest(page: Page, name: string) {
  await page.getByRole("link", { name: "New request" }).click();
  await expect(page.getByRole("heading", { name: "New event request" })).toBeVisible();
  await page.getByLabel("Event name").fill(name);
  await page.getByLabel("Purpose").fill("Share faculty research");
  await page.getByLabel("Description").fill("A one-day symposium for the school of computing.");
  await page.getByLabel("Proposed start").fill(CARD_START_LOCAL);
  await page.getByLabel("Proposed end").fill(CARD_END_LOCAL);
  await page.getByLabel("Expected attendance").fill("150");
  await page.getByLabel("Accessibility needs").fill("Step-free access to the stage");
  await page.getByRole("button", { name: "Submit request" }).click();

  await expect(page.getByRole("heading", { name })).toBeVisible();
  await expect(sideStatus(page)).toHaveText("Submitted");
  // The id is the last part of the address bar (tests/README.md, "Setup procedures").
  const id = /#\/requests\/([0-9a-f-]{36})$/.exec(page.url())?.[1];
  const reference = (await page.getByText(REFERENCE).textContent())?.trim();
  expect(id).toBeTruthy();
  expect(reference).toMatch(REFERENCE);
  return { id: id!, reference: reference! };
}

/** FX-UNDER-REVIEW's screen steps: the assigned coordinator opens the request from the review queue. */
async function openFromQueue(page: Page, event: EventRow) {
  await page.getByRole("link", { name: "Review queue" }).click();
  await rowWith(page, event.name).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
  await expect(sideStatus(page)).toHaveText("Under Review");
}

/** FX-APPROVED: FX-UNDER-REVIEW, then "Approve". */
async function approveOnScreen(page: Page, event: EventRow) {
  await signIn(page, "coordinator");
  await openFromQueue(page, event);
  await page.getByRole("button", { name: "Approve" }).click();
  await expect(page.getByText("This request is Approved")).toBeVisible();
}

test.describe("B1 the submission's message", () => {
  test("B1-T5 submitting a request emits the event that a coordinator's notification is built from", { tag: ["@B1", "@B1-T5"] }, async ({ page }) => {
    await signIn(page, "organiser");
    const { id, reference } = await submitTheStandardRequest(page, uniqueName("Annual Research Symposium"));

    const rows = await query<OutboxRow & { reference: string; owner_id: string; published_at: Date | null }>(
      `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference,
              envelope->'data'->>'ownerId' as owner_id, published_at
         from event.outbox where message_key = $1 order by created_at`,
      [id],
    );
    const submitted = rows.filter((row) => row.message_type === "event.submitted");
    expect(submitted).toEqual([{ message_type: "event.submitted", reference, owner_id: ACCOUNTS.organiser.id, published_at: null }]);
  });
});

test.describe("D2 the clarification request's message", () => {
  test("D2-T7 asking for clarification emits the event the organiser's notification is built from", { tag: ["@D2", "@D2-T7"] }, async ({ page }) => {
    const request = await assignedRequest();

    // FX-AWAITING: FX-UNDER-REVIEW, then the README's question.
    await signIn(page, "coordinator");
    await openFromQueue(page, request);
    await page.getByPlaceholder("What do you need the organiser to clarify?").fill("Please confirm the expected attendance.");
    await page.getByRole("button", { name: "Send clarification request" }).click();
    await expect(sideStatus(page)).toHaveText("Awaiting Clarification");

    const rows = await query<OutboxRow & { reference: string; owner_id: string; requested_by: string }>(
      `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference,
              envelope->'data'->>'ownerId' as owner_id, envelope->'data'->>'requestedBy' as requested_by
         from event.outbox where message_key = $1 order by created_at`,
      [request.id],
    );
    expect(rows.filter((row) => row.message_type === "event.clarification-requested")).toEqual([
      {
        message_type: "event.clarification-requested",
        reference: request.reference,
        owner_id: ACCOUNTS.organiser.id,
        requested_by: ACCOUNTS.coordinator.id,
      },
    ]);
  });
});

test.describe("D3 the clarification response's message", () => {
  test("D3-T8 the organiser's response emits the event the asking coordinator's notification is built from", { tag: ["@D3", "@D3-T8"] }, async ({ page }) => {
    // FX-AWAITING, asked by Coordinator One; then the organiser responds with "Answered.".
    const request = await awaitingRequest();

    await signIn(page, "organiser");
    await page.goto(`/#/requests/${request.id}`);
    await expect(page.getByRole("heading", { name: request.name })).toBeVisible();
    await page.getByPlaceholder("Your reply").fill("Answered.");
    await page.getByRole("button", { name: "Send response" }).click();
    await expect(page.getByText("Answered.", { exact: true })).toBeVisible();
    await expect(sideStatus(page)).toHaveText("Under Review");

    const rows = await query<OutboxRow & { reference: string; requested_by: string; responded_by: string }>(
      `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference,
              envelope->'data'->>'requestedBy' as requested_by, envelope->'data'->>'respondedBy' as responded_by
         from event.outbox where message_key = $1 order by created_at`,
      [request.id],
    );
    expect(rows.filter((row) => row.message_type === "event.clarification-responded")).toEqual([
      {
        message_type: "event.clarification-responded",
        reference: request.reference,
        requested_by: ACCOUNTS.coordinator.id,
        responded_by: ACCOUNTS.organiser.id,
      },
    ]);
  });
});

test.describe("D4 the approval's messages", () => {
  test("D4-T5 approving a request emits the event the organiser's notification is built from", { tag: ["@D4", "@D4-T5"] }, async ({ page }) => {
    const request = await assignedRequest();
    await approveOnScreen(page, request);

    const rows = await query<OutboxRow & { reference: string; owner_id: string; approved_by: string }>(
      `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference,
              envelope->'data'->>'ownerId' as owner_id, envelope->'data'->>'approvedBy' as approved_by
         from event.outbox where message_key = $1 order by created_at`,
      [request.id],
    );
    expect(rows.filter((row) => row.message_type === "event.approved")).toEqual([
      { message_type: "event.approved", reference: request.reference, owner_id: ACCOUNTS.organiser.id, approved_by: ACCOUNTS.coordinator.id },
    ]);
    expect(rows.filter((row) => row.message_type === "event.rejected")).toEqual([]);
  });

  test("D4-T6 approval alone creates no venue booking and no equipment reservation", { tag: ["@D4", "@D4-T6"] }, async ({ page }) => {
    const request = await assignedRequest();
    await approveOnScreen(page, request);

    // Step 1: the card's query.
    const types = (
      await query<OutboxRow>("select envelope->>'type' as message_type from event.outbox where message_key = $1 order by created_at", [request.id])
    ).map((row) => row.message_type);
    // The three the card names, each once.
    for (const type of ["event.submitted", "event.coordinator-assigned", "event.approved"]) {
      expect(types.filter((t) => t === type), type).toHaveLength(1);
    }
    // Beside them, only what every status change and the Lead's assignment now write for the other
    // services' copies of the event: event.status-changed (EN-11) and event.listing-changed (R1; R5
    // for the assignment). The card predates both, so its "exactly these three" no longer holds.
    expect([...new Set(types)].sort()).toEqual(
      ["event.approved", "event.coordinator-assigned", "event.listing-changed", "event.status-changed", "event.submitted"],
    );
    const changes = await query<{ new_status: string }>(
      `select envelope->'data'->>'newStatus' as new_status from event.outbox
        where message_key = $1 and envelope->>'type' = 'event.status-changed' order by seq`,
      [request.id],
    );
    expect(changes.map((row) => row.new_status)).toEqual(["SUBMITTED", "UNDER_REVIEW", "APPROVED"]);
    const topics = await query<{ topic: string }>("select distinct topic from event.outbox where message_key = $1", [request.id]);
    expect(topics).toEqual([{ topic: EVENT_TOPIC }]);

    // Nothing was booked, held, requested or reserved for the event (H1, L1, L3, O1, Q1 have landed since the card was written).
    const arrangements = await query<{ kind: string; n: number }>(
      `select 'venue slot' as kind, count(*)::int as n from venue.venue_slots where event_id = $1
       union all select 'booking request', count(*)::int from venue.booking_requests where event_id = $1
       union all select 'hold', count(*)::int from venue.holds where event_id = $1
       union all select 'equipment line', count(*)::int from equipment.equipment_request_lines where event_id = $1
       union all select 'reservation', count(*)::int from equipment.reservations where event_id = $1`,
      [request.id],
    );
    expect(arrangements.filter((row) => row.n > 0)).toEqual([]);

    // Step 2: the coordinator, still signed in, opens the approved request; its venue requests and
    // its equipment request hold nothing.
    await page.getByRole("link", { name: "All events" }).click();
    await rowWith(page, request.name).getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: request.name })).toBeVisible();
    await expect(sideStatus(page)).toHaveText("Approved");

    await page.getByRole("link", { name: "Venue requests" }).click();
    await expect(page.getByRole("heading", { name: "Venue requests" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("No venue has been requested for this event yet.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Bookings" })).toHaveCount(0);
    await expect(page.getByText("No venue has been held for this event.")).toBeVisible();

    await page.getByRole("link", { name: "All events" }).click();
    await rowWith(page, request.name).getByRole("link", { name: "Open" }).click();
    await expect(page.getByRole("heading", { name: request.name })).toBeVisible();
    await page.getByRole("link", { name: "Equipment request" }).click();
    await expect(page.getByRole("heading", { name: "Equipment request" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("No equipment has been requested for this event yet.")).toBeVisible();
  });
});

test.describe("D5 the rejection's message", () => {
  test("D5-T7 rejecting a request emits the event the organiser's notification is built from, carrying the reason", { tag: ["@D5", "@D5-T7"] }, async ({ page }) => {
    const request = await assignedRequest();
    const reason = "No suitable venue is available.";

    // FX-REJECTED: FX-UNDER-REVIEW, then "Reject" with the README's reason.
    await signIn(page, "coordinator");
    await openFromQueue(page, request);
    await page.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByPlaceholder("Why can this request not be supported?").fill(reason);
    await dialog.getByRole("button", { name: "Reject request" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(sideStatus(page)).toHaveText("Rejected");

    const rows = await query<OutboxRow & { reference: string; owner_id: string; reason: string }>(
      `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference,
              envelope->'data'->>'ownerId' as owner_id, envelope->'data'->>'reason' as reason
         from event.outbox where message_key = $1 order by created_at`,
      [request.id],
    );
    expect(rows.filter((row) => row.message_type === "event.rejected")).toEqual([
      { message_type: "event.rejected", reference: request.reference, owner_id: ACCOUNTS.organiser.id, reason },
    ]);
  });
});

test.describe("E1 the assignment's message (since E3, the Lead's)", () => {
  test("E1-T2 assigning a coordinator emits the event that coordinator's notification is built from", { tag: ["@E1", "@E1-T2"] }, async ({ page }) => {
    const name = uniqueName("Annual Research Symposium");
    const assignmentMessages = (id: string) =>
      query<OutboxRow & { reference: string; event_name: string; coordinator_id: string; assignment_rule: string }>(
        `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference,
                envelope->'data'->>'eventName' as event_name, envelope->'data'->>'coordinatorId' as coordinator_id,
                envelope->'data'->>'assignmentRule' as assignment_rule
           from event.outbox where message_key = $1 order by created_at`,
        [id],
      ).then((rows) => rows.filter((row) => row.message_type === "event.coordinator-assigned"));

    // Steps 1 to 3: the organiser submits; since E3 nobody is assigned yet, and nothing announces an assignment.
    await signIn(page, "organiser");
    const { id, reference } = await submitTheStandardRequest(page, name);
    await expect(sideValue(page, "Assigned coordinator")).toHaveText("Awaiting assignment");
    expect(await assignmentMessages(id)).toEqual([]);

    // Step 4: the Lead assigns Coordinator One from the unassigned queue.
    await signOut(page);
    await signIn(page, "lead");
    await expect(page.getByRole("heading", { name: "Unassigned requests" })).toBeVisible();
    await rowWith(page, name).getByRole("link", { name: reference }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await page.getByLabel("Coordinator", { exact: true }).selectOption(ACCOUNTS.coordinator.id);
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    await expect(page.getByText("Assigned to Coordinator One.")).toBeVisible();

    // Step 5: the organiser's request now names the assigned coordinator.
    await signOut(page);
    await signIn(page, "organiser");
    await page.goto(`/#/requests/${id}`);
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(sideValue(page, "Assigned coordinator")).toHaveText(ACCOUNTS.coordinator.displayName);

    // Step 6: the card's query.
    expect(await assignmentMessages(id)).toEqual([
      { message_type: "event.coordinator-assigned", reference, event_name: name, coordinator_id: ACCOUNTS.coordinator.id, assignment_rule: "LEAD" },
    ]);
  });
});
