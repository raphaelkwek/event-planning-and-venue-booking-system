import type { Page } from "@playwright/test";
import { ACCOUNTS } from "./support/accounts.js";
import { expect, signIn, signOut, test, uniqueName } from "./support/fixtures.js";
import { approvedRequest, underReviewRequest, type EventRow } from "./support/seed.js";
import {
  CARD_START,
  assignedRequest,
  awaitingRequest,
  query,
  rejectedRequest,
  rowWith,
  sendFromConsole,
  shownAs,
} from "./support/seed-events.js";

/**
 * D1 the review queue, D2 asking for clarification, D4 approving and D5 rejecting, through the
 * coordinator's and the organiser's screens.
 *
 * Since E3 a submitted request reaches a coordinator's queue only once the Lead has assigned it,
 * so the cards' FX-SUBMITTED is FX-ASSIGNED here (tests/README.md).
 */

const status = (page: Page) => page.locator("aside h3 + *").first();
const reviewer = (page: Page) => page.locator("aside dt").filter({ hasText: /^Reviewer$/ }).locator("xpath=following-sibling::dd[1]");
const clarifications = (page: Page) => page.getByRole("heading", { name: "Clarifications" }).locator("xpath=following-sibling::*");

async function openReview(page: Page, event: EventRow) {
  await page.goto(`/#/review/${event.id}`);
  await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
}

async function openFromQueue(page: Page, event: EventRow) {
  await page.getByRole("link", { name: "Review queue" }).click();
  await rowWith(page, event.name).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: event.name })).toBeVisible();
}

test.describe("D1 review queue", () => {
  test("D1-T1 the queue lists every request awaiting a decision, and no decided ones", { tag: ["@D1", "@D1-T1"] }, async ({ page, a11y }) => {
    const awaitingReview = await assignedRequest({ name: uniqueName("Awaiting review") });
    const beingReviewed = await underReviewRequest({ name: uniqueName("Being reviewed") });
    const waiting = await awaitingRequest({ name: uniqueName("Waiting on organiser") });
    const approved = await approvedRequest({ name: uniqueName("Already approved") });
    const rejected = await rejectedRequest({ name: uniqueName("Already rejected") });

    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "Review queue" }).click();
    await expect(rowWith(page, awaitingReview.name)).toContainText("Submitted");
    await expect(rowWith(page, beingReviewed.name)).toContainText("Under Review");
    await expect(rowWith(page, waiting.name)).toContainText("Awaiting Clarification");
    await expect(page.getByText(approved.name)).toHaveCount(0);
    await expect(page.getByText(rejected.name)).toHaveCount(0);
    await a11y("review queue");
  });

  test("D1-T2 each queue row shows the details a coordinator triages on", { tag: ["@D1", "@D1-T2"] }, async ({ page }) => {
    const request = await assignedRequest({ proposedStartAt: CARD_START, proposedEndAt: "2026-12-02T10:00:00.000Z" });

    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "Review queue" }).click();
    const cells = rowWith(page, request.name).getByRole("cell");
    await expect(cells.nth(0)).toHaveText(request.reference);
    await expect(cells.nth(1)).toHaveText(request.name);
    await expect(cells.nth(2)).toHaveText(await shownAs(page, CARD_START));
    await expect(cells.nth(3)).toHaveText("150");
    await expect(cells.nth(4)).toHaveText("Organiser One");
    await expect(cells.nth(5)).toHaveText(await shownAs(page, request.submittedAt as string));
    await expect(cells.nth(6)).toHaveText("Submitted");
  });

  test("D1-T4 opening a request shows its full submitted content, read-only", { tag: ["@D1", "@D1-T4"] }, async ({ page, a11y }) => {
    const request = await assignedRequest({
      venueRequirements: { layout: "Theatre", facilities: ["Projector", "Microphone"] },
      equipmentRequired: true,
      equipmentRequirements: [{ equipmentType: "Wireless microphone", quantity: 4 }],
    });

    await signIn(page, "coordinator");
    await openFromQueue(page, request);
    const main = page.locator("main");
    await expect(main.getByText("Share faculty research", { exact: true })).toBeVisible();
    await expect(main.getByText("A one-day symposium for the school of computing.", { exact: true })).toBeVisible();
    await expect(main.getByText(await shownAs(page, request.proposedStartAt as string), { exact: true })).toBeVisible();
    await expect(main.getByText(await shownAs(page, request.proposedEndAt as string), { exact: true })).toBeVisible();
    await expect(main.getByText("150", { exact: true })).toBeVisible();
    await expect(main.getByText("Step-free access to the stage", { exact: true })).toBeVisible();
    await expect(main.getByText("Room layout: Theatre")).toBeVisible();
    await expect(main.getByText("Facilities: Projector, Microphone")).toBeVisible();
    await expect(main.getByText("4 × Wireless microphone")).toBeVisible();
    // Nothing above can be edited: the only field on the screen is the clarification message.
    await expect(main.getByRole("textbox")).toHaveCount(1);
    await expect(main.getByRole("textbox")).toHaveAttribute("placeholder", "What do you need the organiser to clarify?");
    await a11y("review detail");
  });

  test("D1-T6 a second coordinator opening a request under review sees the first reviewer", { tag: ["@D1", "@D1-T6"] }, async ({ page }) => {
    const request = await underReviewRequest();

    await signIn(page, "coordinator2");
    await openFromQueue(page, request);
    await expect(page.getByText("Already under review")).toBeVisible();
    await expect(page.getByText("Coordinator One opened this request first")).toBeVisible();

    const [row] = await query<{ reviewing_coordinator_id: string }>(
      "select reviewing_coordinator_id from event.events where id = $1",
      [request.id],
    );
    expect(row!.reviewing_coordinator_id).toBe(ACCOUNTS.coordinator.id);
  });

  test("D1-T8 reopening a request already under review changes nothing", { tag: ["@D1", "@D1-T8"] }, async ({ page }) => {
    const request = await underReviewRequest();

    await signIn(page, "coordinator");
    await openFromQueue(page, request);
    await expect(status(page)).toHaveText("Under Review");
    await expect(reviewer(page)).toHaveText("Coordinator One");

    const [row] = await query<{ count: number }>(
      "select count(*)::int as count from event.event_history where event_id = $1 and entry_type = 'STATUS_CHANGE'",
      [request.id],
    );
    expect(row!.count).toBe(2);
  });
});

test.describe("D2 ask for clarification", () => {
  test("D2-T1 the coordinator asks the organiser for clarification", { tag: ["@D2", "@D2-T1"] }, async ({ page, a11y }) => {
    const request = await underReviewRequest();
    const message = "Please confirm the catering requirements.";

    await signIn(page, "coordinator");
    await openReview(page, request);
    await page.getByPlaceholder("What do you need the organiser to clarify?").fill(message);
    await page.getByRole("button", { name: "Send clarification request" }).click();

    const entry = clarifications(page).filter({ hasText: message });
    await expect(entry).toContainText("Awaiting the organiser");
    await expect(status(page)).toHaveText("Awaiting Clarification");
    const [row] = await query<{ requested_by: string; requested_at: Date }>(
      "select requested_by, requested_at from event.clarifications where event_id = $1",
      [request.id],
    );
    expect(row!.requested_by).toBe(ACCOUNTS.coordinator.id);
    await expect(entry).toContainText(await shownAs(page, row!.requested_at.toISOString()));
    await a11y("review detail awaiting clarification");
  });

  test("D2-T2 an empty clarification message is refused and nothing is stored", { tag: ["@D2", "@D2-T2"] }, async ({ page }) => {
    const request = await underReviewRequest();

    await signIn(page, "coordinator");
    await openReview(page, request);
    await page.getByRole("button", { name: "Send clarification request" }).click();

    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
    await expect(page.getByText("A clarification message is required.").first()).toBeVisible();
    await expect(page.getByText("None requested.")).toBeVisible();
    await expect(status(page)).toHaveText("Under Review");
  });

  test("D2-T5 the clarification is visible to the owning organiser and to Event Coordinators", { tag: ["@D2", "@D2-T5"] }, async ({ page, a11y }) => {
    const request = await awaitingRequest();

    await signIn(page, "organiser");
    await page.getByRole("link", { name: "My requests" }).click();
    await rowWith(page, request.name).getByRole("link", { name: "View" }).click();
    const asked = clarifications(page).filter({ hasText: "Coordinator asked" });
    await expect(asked).toContainText("Please confirm the expected attendance.");
    await expect(asked).toContainText("Awaiting your response");
    await a11y("request page awaiting response");

    await signOut(page);
    await signIn(page, "coordinator2");
    await openReview(page, request);
    await expect(clarifications(page).filter({ hasText: "Please confirm the expected attendance." })).toHaveCount(1);
  });

  test("D2-T8 several clarifications on one request are kept in order", { tag: ["@D2", "@D2-T8"] }, async ({ page }) => {
    const request = await underReviewRequest();

    await signIn(page, "coordinator");
    await openReview(page, request);
    await page.getByPlaceholder("What do you need the organiser to clarify?").fill("First question");
    await page.getByRole("button", { name: "Send clarification request" }).click();
    await expect(status(page)).toHaveText("Awaiting Clarification");

    await signOut(page);
    await signIn(page, "organiser");
    await page.goto(`/#/requests/${request.id}`);
    await page.getByPlaceholder("Your reply").fill("First answer");
    await page.getByRole("button", { name: "Send response" }).click();
    await expect(page.getByText("First answer")).toBeVisible();

    await signOut(page);
    await signIn(page, "coordinator");
    await openReview(page, request);
    await page.getByPlaceholder("What do you need the organiser to clarify?").fill("Second question");
    await page.getByRole("button", { name: "Send clarification request" }).click();

    const entries = clarifications(page).filter({ hasText: /First question|Second question/ });
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText("First question");
    await expect(entries.nth(0)).toContainText("Organiser replied");
    await expect(entries.nth(0)).toContainText("First answer");
    await expect(entries.nth(1)).toContainText("Second question");
  });
});

test.describe("D4 approve", () => {
  test("D4-T1 the coordinator approves a request under review", { tag: ["@D4", "@D4-T1"] }, async ({ page, a11y }) => {
    const request = await underReviewRequest();

    await signIn(page, "coordinator");
    await openReview(page, request);
    await page.getByRole("button", { name: "Approve" }).click();

    const decision = page.getByText("This request is Approved").locator("xpath=ancestor::section[1]");
    await expect(page.getByText("This request is Approved")).toBeVisible();
    const [row] = await query<{ decided_at: Date }>("select decided_at from event.events where id = $1", [request.id]);
    await expect(decision.or(page.locator("main"))).toContainText(`Decided ${await shownAs(page, row!.decided_at.toISOString())} by Coordinator One.`);
    await expect(status(page)).toHaveText("Approved");
    await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reject" })).toBeDisabled();
    await a11y("review detail approved");
  });

  test("D4-T2 a request awaiting clarification can be approved", { tag: ["@D4", "@D4-T2"] }, async ({ page }) => {
    const request = await awaitingRequest();

    await signIn(page, "coordinator");
    await openReview(page, request);
    await expect(status(page)).toHaveText("Awaiting Clarification");
    await page.getByRole("button", { name: "Approve" }).click();

    await expect(page.getByText("This request is Approved")).toBeVisible();
    await expect(status(page)).toHaveText("Approved");
  });

  test("D4-T4 the owning organiser sees the approval and its date", { tag: ["@D4", "@D4-T4"] }, async ({ page }) => {
    const request = await approvedRequest();
    const decidedAt = request.decidedAt as string;

    await signIn(page, "organiser");
    await page.getByRole("link", { name: "My requests" }).click();
    await rowWith(page, request.name).getByRole("link", { name: "View" }).click();
    const shown = await shownAs(page, decidedAt);
    await expect(page.getByText("This request was approved")).toBeVisible();
    await expect(page.getByText(`Approved ${shown}.`)).toBeVisible();
    await expect(page.locator("aside dt").filter({ hasText: /^Decision$/ }).locator("xpath=following-sibling::dd[1]")).toHaveText(shown);
  });

  test("D4-T7 a request that already carries a decision cannot be approved again", { tag: ["@D4", "@D4-T7"] }, async ({ page, a11y }) => {
    const request = await approvedRequest();

    await signIn(page, "coordinator");
    await openReview(page, request);
    await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
    const shown = await shownAs(page, request.decidedAt as string);
    await expect(page.locator("main")).toContainText(`Decided ${shown}`);

    const result = await sendFromConsole(page, "POST", `/event/api/v1/events/${request.id}/approve`);
    await expect(result.status).toContainText("409");
    await a11y("direct API console with a refusal");

    await openReview(page, request);
    await expect(page.locator("main")).toContainText(`Decided ${shown}`);
    const [row] = await query<{ decided_at: Date }>("select decided_at from event.events where id = $1", [request.id]);
    expect(row!.decided_at.toISOString()).toBe(new Date(request.decidedAt as string).toISOString());
  });
});

test.describe("D5 reject", () => {
  test("D5-T1 the coordinator rejects a request under review, giving a reason", { tag: ["@D5", "@D5-T1"] }, async ({ page, a11y }) => {
    const request = await underReviewRequest();
    const reason = "No venue can host 150 people on 2 December.";

    await signIn(page, "coordinator");
    await openReview(page, request);
    await page.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await a11y("reject dialog");
    await dialog.getByPlaceholder("Why can this request not be supported?").fill(reason);
    await dialog.getByRole("button", { name: "Reject request" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(status(page)).toHaveText("Rejected");
    const [row] = await query<{ decided_at: Date }>("select decided_at from event.events where id = $1", [request.id]);
    await expect(page.locator("main")).toContainText(`Decided ${await shownAs(page, row!.decided_at.toISOString())} by Coordinator One. Reason: ${reason}`);
    await expect(page.getByRole("button", { name: "Approve" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Reject" })).toBeDisabled();
  });

  test("D5-T2 rejecting with the reason left empty is refused", { tag: ["@D5", "@D5-T2"] }, async ({ page }) => {
    const request = await underReviewRequest();

    await signIn(page, "coordinator");
    await openReview(page, request);
    await page.getByRole("button", { name: "Reject" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Reject request" }).click();
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText("A reason is required to reject an event request.").first()).toBeVisible();

    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(status(page)).toHaveText("Under Review");
    await expect(page.getByText(/This request is (Approved|Rejected)/)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Approve" })).toBeEnabled();
    await expect(page.getByRole("button", { name: "Reject" })).toBeEnabled();
  });

  test("D5-T6 the reason is shown to the owning organiser, and another organiser cannot see the request", { tag: ["@D5", "@D5-T6"] }, async ({ page }) => {
    const request = await rejectedRequest();
    const reason = "No suitable venue is available.";

    await signIn(page, "organiser");
    await page.getByRole("link", { name: "My requests" }).click();
    await rowWith(page, request.name).getByRole("link", { name: "View" }).click();
    await expect(page.getByText("This request was rejected")).toBeVisible();
    await expect(page.getByText(reason, { exact: true })).toBeVisible();

    await signOut(page);
    await signIn(page, "organiser2");
    await page.goto(`/#/requests/${request.id}`);
    await expect(page.getByText("EVENT_NOT_FOUND")).toBeVisible();
    await expect(page.getByText(reason)).toHaveCount(0);
    await expect(page.getByText(request.name)).toHaveCount(0);
  });
});

