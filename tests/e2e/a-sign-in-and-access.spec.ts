import { ACCOUNTS, SEED_PASSWORD } from "./support/accounts.js";
import { expect, signIn, signInWithForm, signOut, test, uniqueName } from "./support/fixtures.js";
import { approvedRequest, submitRequest, underReviewRequest } from "./support/seed.js";
import { assignedRequest, rowWith, saveDraft } from "./support/seed-events.js";

/** A1: signing in and out through the real sign-in screen, against identity and the fake Supabase Auth. */
test.describe("A1 sign-in", () => {
  test("A1-T1 an Event Organiser signs in and lands on My requests", { tag: ["@A1", "@A1-T1"] }, async ({ page, a11y }) => {
    await page.goto("/");
    await a11y("sign-in");
    await page.getByLabel("Email").fill(ACCOUNTS.organiser.email);
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "My requests" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("organiser@connectsphere.test · Event Organiser");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await a11y("my requests");
  });

  test("A1-T2 an Event Coordinator signs in and lands on the Review queue", { tag: ["@A1", "@A1-T2"] }, async ({ page, a11y }) => {
    await signInWithForm(page, "coordinator");
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("coordinator@connectsphere.test · Event Coordinator");
    await a11y("review queue");
  });

  test("A1-T3 Venue Staff, who have no event screens, land on the Direct API console", { tag: ["@A1", "@A1-T3"] }, async ({ page, a11y }) => {
    await signInWithForm(page, "venuestaff");
    await expect(page.getByRole("heading", { name: "Direct API console" })).toBeVisible();
    await expect(page.getByRole("banner")).toContainText("venuestaff@connectsphere.test · Venue Staff");
    await a11y("direct API console");
  });

  test("A1-T4 a wrong password is refused without saying which field was wrong", { tag: ["@A1", "@A1-T4"] }, async ({ page, a11y }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(ACCOUNTS.organiser.email);
    await page.getByLabel("Password").fill("WrongPassword-1");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("INVALID_CREDENTIALS")).toBeVisible();
    await expect(page.getByText("email or password is incorrect")).toBeVisible();
    await expect(page.getByText("HTTP 401")).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await a11y("sign-in refused");
  });

  test("A1-T5 an unknown email is refused with the same message as a wrong password", { tag: ["@A1", "@A1-T5"] }, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("nobody@connectsphere.test");
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("INVALID_CREDENTIALS")).toBeVisible();
    await expect(page.getByText("email or password is incorrect", { exact: true })).toBeVisible();
    await expect(page.getByText("HTTP 401")).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
  });

  test("A1-T6 a deactivated account is refused with a different message", { tag: ["@A1", "@A1-T6"] }, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(ACCOUNTS.deactivated.email);
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("ACCOUNT_DEACTIVATED")).toBeVisible();
    await expect(page.getByText("This account has been deactivated. Contact an administrator.")).toBeVisible();
    await expect(page.getByText("HTTP 403")).toBeVisible();
    await expect(page.getByText("INVALID_CREDENTIALS")).toHaveCount(0);
    await expect(page.getByText("email or password is incorrect")).toHaveCount(0);
    await expect(page.getByRole("banner")).toHaveCount(0);
  });

  test("A1-T9 signing out ends the session, and going back shows no event data", { tag: ["@A1", "@A1-T9"] }, async ({ page }) => {
    const request = await submitRequest();
    await signIn(page, "organiser");
    // Two screens of the app's own history behind "My requests", so Back stays in the app.
    await page.getByRole("link", { name: "New request" }).click();
    await expect(page.getByRole("heading", { name: "New event request" })).toBeVisible();
    await page.getByRole("link", { name: "My requests" }).click();
    await expect(rowWith(page, request.name)).toBeVisible();
    await expect(page.getByText(request.reference)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    const signInButton = page.getByRole("button", { name: "Sign in" });
    await expect(signInButton).toBeVisible();

    for (let back = 0; back < 2; back++) {
      await page.goBack();
      await expect(signInButton).toBeVisible();
      await expect(page.getByText(request.name)).toHaveCount(0);
      await expect(page.getByText(request.reference)).toHaveCount(0);
      await expect(page.getByRole("table")).toHaveCount(0);
    }
    expect(await page.evaluate(() => sessionStorage.getItem("connectsphere.session"))).toBeNull();
  });

  test("A1-T10 after signing out, the next user starts on their own screen", { tag: ["@A1", "@A1-T10"] }, async ({ page }) => {
    await signIn(page, "coordinator");
    await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();

    await signOut(page);
    // Record whether the review queue is ever drawn from here on, not only at the end.
    await page.evaluate(() => {
      const seen = { reviewQueue: false };
      (window as unknown as { __seen: typeof seen }).__seen = seen;
      new MutationObserver(() => {
        if ([...document.querySelectorAll("h2")].some((h) => h.textContent === "Review queue")) seen.reviewQueue = true;
      }).observe(document.body, { childList: true, subtree: true });
    });
    await page.getByLabel("Email").fill(ACCOUNTS.organiser.email);
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "My requests" })).toBeVisible();
    await expect(page).toHaveURL(/#\/requests$/);
    expect(await page.evaluate(() => (window as unknown as { __seen: { reviewQueue: boolean } }).__seen.reviewQueue)).toBe(false);
  });

  test("A1-T11 signing in with the email left empty is refused", { tag: ["@A1", "@A1-T11"] }, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill("");
    await page.getByLabel("Password").fill(SEED_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("VALIDATION_FAILED")).toBeVisible();
    await expect(page.getByText("email and password are both required.")).toBeVisible();
    await expect(page.getByText("HTTP 400")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });
});

/** A2: each role's screens, and the server's refusal behind them. */
test.describe("A2 role navigation", () => {
  test("A2-T4 an organiser following a direct link to a coordinator screen is sent to their own", { tag: ["@A2", "@A2-T4"] }, async ({ page }) => {
    const request = await underReviewRequest();
    await signIn(page, "organiser");

    for (const path of ["/#/queue", `/#/review/${request.id}`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "My requests" })).toBeVisible();
      await expect(page).toHaveURL(/#\/requests$/);
      await expect(page.getByRole("heading", { name: "Review queue" })).toHaveCount(0);
      await expect(page.getByText("Ask for clarification")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Reject" })).toHaveCount(0);
    }
  });
});

/** A3: what each role can see is filtered on the server. */
test.describe("A3 access scope", () => {
  test("A3-T1 an organiser's list contains only the requests they own", { tag: ["@A3", "@A3-T1"] }, async ({ page, a11y }) => {
    const others = await submitRequest({ name: uniqueName("Organiser two's symposium") }, "organiser2");
    const mine = await submitRequest();

    await signIn(page, "organiser");
    await page.getByRole("link", { name: "My requests" }).click();
    await expect(rowWith(page, mine.name)).toBeVisible();
    await expect(page.getByText(others.name)).toHaveCount(0);
    await a11y("my requests");
  });

  test("A3-T2 an organiser opening another organiser's request by direct link gets no event data", { tag: ["@A3", "@A3-T2"] }, async ({ page, a11y }) => {
    const others = await submitRequest({ name: uniqueName("Organiser two's symposium") }, "organiser2");

    await signIn(page, "organiser");
    await page.goto(`/#/requests/${others.id}`);
    await expect(page.getByText("EVENT_NOT_FOUND")).toBeVisible();
    await expect(page.getByText("No event with that reference is available to you.")).toBeVisible();
    await expect(page.getByText("HTTP 404")).toBeVisible();
    await expect(page.getByText(others.name)).toHaveCount(0);
    await expect(page.getByText("Share faculty research")).toHaveCount(0);
    await expect(page.getByText("A one-day symposium for the school of computing.")).toHaveCount(0);
    await expect(page.getByText(others.reference)).toHaveCount(0);
    await a11y("request refused");
  });

  test("A3-T4 a coordinator's event list contains the events assigned to them, whoever owns them, and no other", { tag: ["@A3", "@A3-T4"] }, async ({ page, a11y }) => {
    // A4 (CR-05) revised the card: the list holds only the coordinator's own assignments.
    const approved = await approvedRequest();
    const unassigned = await submitRequest({ name: uniqueName("Organiser two's symposium") }, "organiser2");
    const elsewhere = await assignedRequest({ name: uniqueName("Assigned elsewhere") }, "coordinator2");
    const draft = await saveDraft({ name: uniqueName("Unfinished idea") });

    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "All events" }).click();
    await expect(page.getByRole("heading", { name: "All events" })).toBeVisible();
    await expect(rowWith(page, approved.name)).toContainText("Approved");
    await expect(page.getByText(unassigned.name)).toHaveCount(0);
    await expect(page.getByText(elsewhere.name)).toHaveCount(0);
    await expect(page.getByText(draft.name)).toHaveCount(0);
    await a11y("all events");
  });

  test("A3-T5 a coordinator's lists show only their own events, each marked as theirs", { tag: ["@A3", "@A3-T5"] }, async ({ page }) => {
    // Since E3 the Lead assigns each request, which replaces the card's EVENT_COORDINATOR_POOL setting.
    const first = await assignedRequest({ name: uniqueName("First assigned request") }, "coordinator");
    const second = await assignedRequest({ name: uniqueName("Second assigned request") }, "coordinator2");

    await signIn(page, "coordinator");
    await page.getByRole("link", { name: "Review queue" }).click();
    await expect(rowWith(page, first.name)).toContainText("You");
    await expect(page.getByText(second.name)).toHaveCount(0);

    await page.getByRole("link", { name: "All events" }).click();
    await expect(rowWith(page, first.name)).toContainText("You");
    await expect(page.getByText(second.name)).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Every event" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Assigned to me" })).toHaveCount(0);
  });
});
