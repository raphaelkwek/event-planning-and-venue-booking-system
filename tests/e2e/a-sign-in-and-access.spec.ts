import { ACCOUNTS, SEED_PASSWORD } from "./support/accounts.js";
import { expect, signIn, test } from "./support/fixtures.js";

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

  test("A1-T4 a wrong password is refused without saying which field was wrong", { tag: ["@A1", "@A1-T4"] }, async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Email").fill(ACCOUNTS.organiser.email);
    await page.getByLabel("Password").fill("WrongPassword-1");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("INVALID_CREDENTIALS")).toBeVisible();
    await expect(page.getByText("email or password is incorrect")).toBeVisible();
    await expect(page.getByText("HTTP 401")).toBeVisible();
    await expect(page.getByRole("banner")).toHaveCount(0);
    await expect(page.getByRole("navigation")).toHaveCount(0);
  });

  test("A1-T2 an Event Coordinator signs in", { tag: ["@A1", "@A1-T2"] }, async ({ page }) => {
    await signIn(page, "coordinator");
    await expect(page.getByRole("banner")).toContainText("coordinator@connectsphere.test · Event Coordinator");
  });
});
