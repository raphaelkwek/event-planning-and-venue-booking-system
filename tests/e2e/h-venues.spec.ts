import type { Page } from "@playwright/test";
import { expect, signIn, test, uniqueName } from "./support/fixtures.js";
import { call } from "./support/api.js";
import { approvedRequest, createVenue, type VenueRow } from "./support/seed.js";
import { makeInactive } from "./support/seed-venues.js";

/**
 * The venue catalogue (H1, H2), venue search (J1, J2) and the suitability check's access rule
 * (K1), through the real screens. Each journey creates its own venues, with names no other run
 * has used, and judges only those rows.
 */

const HOURS = [
  ["Monday", "08:00–22:00"],
  ["Tuesday", "08:00–22:00"],
  ["Wednesday", "08:00–22:00"],
  ["Thursday", "08:00–22:00"],
  ["Friday", "08:00–22:00"],
  ["Saturday", "09:00–18:00"],
  ["Sunday", "Closed"],
] as const;

const venueRow = (page: Page, name: string) => page.getByRole("row").filter({ hasText: name });

async function openVenues(page: Page) {
  await page.getByRole("navigation").getByRole("link", { name: "Venues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Venues", exact: true })).toBeVisible();
}

test.describe("H1 maintain the venue catalogue", () => {
  test("H1-T1 Venue Staff create a venue with every catalogue attribute", { tag: ["@H1", "@H1-T1"] }, async ({ page, a11y }) => {
    const name = uniqueName("Lee Kong Chian Auditorium");
    await signIn(page, "venuestaff");
    await openVenues(page);
    await a11y("venues");

    await page.getByRole("button", { name: "New venue" }).click();
    await expect(page.getByRole("heading", { name: "New venue" })).toBeVisible();
    await a11y("new venue");

    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByLabel("Building / location").fill("School of Computing, Level 1");
    await page.getByLabel("Maximum capacity").fill("300");
    await page.getByRole("button", { name: "Add layout" }).click();
    await page.getByRole("button", { name: "Add layout" }).click();
    const layouts = [
      ["Theatre", "300"],
      ["Classroom", "120"],
      ["Banquet", "180"],
    ] as const;
    for (const [index, [layout, capacity]] of layouts.entries()) {
      await page.getByLabel(`Layout ${index + 1}`, { exact: true }).fill(layout);
      await page.getByLabel(`Layout ${index + 1} capacity`, { exact: true }).fill(capacity);
    }
    await page.getByLabel("Facilities (one per line)").fill("Projector\nWireless microphones\nStage lighting");
    await page.getByLabel("Accessibility features (one per line)").fill("Step-free access\nHearing loop\nAccessible toilet");
    await page.getByLabel("Saturday opens").fill("09:00");
    await page.getByLabel("Saturday closes").fill("18:00");
    await page.getByLabel("Sunday closed").check({ force: true });
    await page.getByRole("button", { name: "Save venue" }).click();

    await expect(page.getByText("Venue saved.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Edit venue" })).toBeVisible();
    await expect(page.getByLabel("Name", { exact: true })).toHaveValue(name);
    await expect(page.getByLabel("Building / location")).toHaveValue("School of Computing, Level 1");
    await expect(page.getByLabel("Maximum capacity")).toHaveValue("300");
    for (const [index, [layout, capacity]] of layouts.entries()) {
      await expect(page.getByLabel(`Layout ${index + 1}`, { exact: true })).toHaveValue(layout);
      await expect(page.getByLabel(`Layout ${index + 1} capacity`, { exact: true })).toHaveValue(capacity);
    }
    await expect(page.getByLabel("Facilities (one per line)")).toHaveValue("Projector\nWireless microphones\nStage lighting");
    await expect(page.getByLabel("Accessibility features (one per line)")).toHaveValue("Step-free access\nHearing loop\nAccessible toilet");
    for (const day of ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]) {
      await expect(page.getByLabel(`${day} opens`)).toHaveValue("08:00");
      await expect(page.getByLabel(`${day} closes`)).toHaveValue("22:00");
      await expect(page.getByLabel(`${day} closed`)).not.toBeChecked();
    }
    await expect(page.getByLabel("Saturday opens")).toHaveValue("09:00");
    await expect(page.getByLabel("Saturday closes")).toHaveValue("18:00");
    await expect(page.getByLabel("Sunday closed")).toBeChecked();
    await a11y("edit venue after saving");

    await openVenues(page);
    await expect(venueRow(page, name)).toHaveCount(1);
    await expect(venueRow(page, name)).toContainText("Active");
  });
});

test.describe("H2 view a venue's details", () => {
  test("H2-T1 an Event Coordinator sees every catalogue attribute of a venue", { tag: ["@H2", "@H2-T1"] }, async ({ page, a11y }) => {
    const venue = await createVenue();
    await signIn(page, "coordinator");
    await openVenues(page);
    await venueRow(page, venue.name).getByRole("link", { name: "View" }).click();

    await expect(page.getByRole("heading", { name: venue.name, level: 2 })).toBeVisible();
    const summary = page.getByRole("region", { name: "Summary" });
    await expect(summary).toContainText("Building / location");
    await expect(summary).toContainText("School of Computing, Level 1");
    await expect(summary).toContainText("Maximum capacity300");
    await expect(summary).toContainText("Active");

    const layouts = page.getByRole("region", { name: "Layouts" });
    for (const [layout, capacity] of [
      ["Theatre", "300"],
      ["Classroom", "120"],
      ["Banquet", "180"],
    ]) {
      await expect(layouts.getByRole("row", { name: `${layout} ${capacity}` })).toBeVisible();
    }
    await expect(page.getByRole("region", { name: "Facilities" }).getByRole("listitem")).toHaveText([
      "Projector",
      "Wireless microphones",
      "Stage lighting",
    ]);
    await expect(page.getByRole("region", { name: "Accessibility features" }).getByRole("listitem")).toHaveText([
      "Step-free access",
      "Hearing loop",
      "Accessible toilet",
    ]);
    const hours = page.getByRole("region", { name: "Operating hours" });
    for (const [day, text] of HOURS) {
      await expect(hours.getByRole("row", { name: `${day} ${text}` })).toBeVisible();
    }
    await a11y("venue detail");
  });
});

/**
 * J1 and J2 run against their own copy of FX-SEARCH's venues (tests/J1/README.md): the same
 * attributes, with a suffix on each name and building so a run judges only its own rows.
 */
async function fxSearchVenues() {
  const suffix = uniqueName("").trim();
  const science = `FX Science Block ${suffix}`;
  const arts = `FX Arts Building ${suffix}`;
  const weekday = { opensAt: "08:00", closesAt: "22:00" };
  const hours = {
    monday: weekday,
    tuesday: weekday,
    wednesday: weekday,
    thursday: weekday,
    friday: weekday,
    saturday: { opensAt: "09:00", closesAt: "18:00" },
    sunday: null,
  };
  const make = (name: string, overrides: Record<string, unknown>) =>
    createVenue({ name: `${name} ${suffix}`, operatingHours: hours, ...overrides });
  const auditorium = await make("FX Auditorium", {
    building: science,
    maxCapacity: 300,
    layouts: [
      { name: "Theatre", capacity: 300 },
      { name: "Classroom", capacity: 120 },
    ],
    facilities: ["Projector", "Wireless microphones"],
    accessibilityFeatures: ["Step-free access", "Hearing loop"],
  });
  const seminar = await make("FX Seminar Room", {
    building: science,
    maxCapacity: 60,
    layouts: [
      { name: "Classroom", capacity: 40 },
      { name: "Boardroom", capacity: 20 },
    ],
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
  });
  const lectureHall = await make("FX Lecture Hall", {
    building: arts,
    maxCapacity: 200,
    layouts: [
      { name: "Theatre", capacity: 200 },
      { name: "Classroom", capacity: 80 },
    ],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
  });
  const lateStudio = await make("FX Late Studio", {
    building: arts,
    maxCapacity: 40,
    layouts: [{ name: "Classroom", capacity: 40 }],
    facilities: ["Projector"],
    accessibilityFeatures: ["Step-free access"],
  });
  const oldGymBody = {
    building: arts,
    maxCapacity: 500,
    layouts: [{ name: "Theatre", capacity: 500 }],
    facilities: ["Projector", "Wireless microphones", "Stage lighting"],
    accessibilityFeatures: ["Step-free access", "Hearing loop", "Accessible toilet"],
    operatingHours: hours,
  };
  const oldGym = await make("FX Old Gym", oldGymBody);
  await makeInactive(oldGym, oldGymBody);
  return { suffix, science, arts, active: [auditorium, seminar, lectureHall, lateStudio] as VenueRow[], oldGym };
}

async function openSearch(page: Page) {
  await page.getByRole("navigation").getByRole("link", { name: "Find a venue" }).click();
  await expect(page.getByRole("heading", { name: "Find a venue" })).toBeVisible();
}

const results = (page: Page) => page.getByRole("region", { name: "Results" });

test.describe("J1 and J2 find a venue", () => {
  test("J1-T1 the search offers every filter, and with none chosen lists the active venues", { tag: ["@J1", "@J1-T1"] }, async ({ page, a11y }) => {
    const fx = await fxSearchVenues();
    await signIn(page, "coordinator");
    await openSearch(page);

    const form = page.getByRole("form", { name: "Venue search" });
    for (const label of ["Search by name or building", "Building / location", "Minimum capacity", "Layout", "From", "To"]) {
      await expect(form.getByLabel(label, { exact: true })).toBeVisible();
    }
    await expect(form.getByRole("group", { name: "Facilities" })).toBeVisible();
    await expect(form.getByRole("group", { name: "Accessibility features" })).toBeVisible();
    await a11y("find a venue");

    await page.getByRole("button", { name: "Search", exact: true }).click();
    for (const venue of fx.active) {
      await expect(results(page).getByRole("link", { name: venue.name, exact: true })).toHaveCount(1);
    }
    await expect(results(page).getByRole("link", { name: fx.oldGym.name })).toHaveCount(0);
    await a11y("search results");
  });

  test("J1-T20 when nothing matches, the list is empty and a message restates every filter", { tag: ["@J1", "@J1-T20"] }, async ({ page, a11y }) => {
    const fx = await fxSearchVenues();
    await signIn(page, "coordinator");
    await openSearch(page);

    await page.getByLabel("Building / location").fill(fx.science);
    await page.getByLabel("Minimum capacity").fill("500");
    await page.getByLabel("Layout", { exact: true }).selectOption("Theatre");
    await page.getByRole("group", { name: "Facilities" }).getByLabel("Projector").check({ force: true });
    await page.getByLabel("From", { exact: true }).fill("2027-03-08T12:00");
    await page.getByLabel("To", { exact: true }).fill("2027-03-08T14:00");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(results(page).getByText("No venues match")).toBeVisible();
    await expect(results(page)).toContainText(
      `No active venue matches all of these filters: available from 2027-03-08 12:00 to 2027-03-08 14:00 (Singapore time); minimum capacity 500 (Theatre layout); building or location containing "${fx.science}"; layout Theatre; facilities Projector.`,
    );
    await expect(results(page).getByRole("table")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);
    await expect(page.getByText("The venues could not be searched")).toHaveCount(0);
    await expect(results(page)).not.toContainText("VALIDATION");
    await a11y("search with no match");

    await page.getByLabel("Minimum capacity").fill("300");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(results(page).getByRole("link", { name: fx.active[0]!.name, exact: true })).toBeVisible();
    await expect(results(page).getByText("No venues match")).toHaveCount(0);
  });

  test("J2-T8 a search that matches nothing gives an empty list and a message naming the search", { tag: ["@J2", "@J2-T8"] }, async ({ page, a11y }) => {
    await signIn(page, "coordinator");
    await openSearch(page);
    await page.getByLabel("Search by name or building").fill("zzzz-no-such-venue");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(results(page).getByText("No venues match")).toBeVisible();
    await expect(results(page)).toContainText('No active venue matches all of these filters: name or building containing "zzzz-no-such-venue".');
    await expect(results(page).getByRole("table")).toHaveCount(0);
    await expect(page.getByText("The venues could not be searched")).toHaveCount(0);
    await a11y("search by name with no match");
  });

  test("J2-T3 a search never returns an inactive venue", { tag: ["@J2", "@J2-T3"] }, async ({ page }) => {
    const fx = await fxSearchVenues();
    await signIn(page, "coordinator");
    await openSearch(page);
    await page.getByLabel("Search by name or building").fill("old gym");
    await page.getByRole("button", { name: "Search", exact: true }).click();

    await expect(results(page).getByText("No venues match")).toBeVisible();
    await expect(results(page)).toContainText('name or building containing "old gym"');
    await expect(results(page).getByRole("link", { name: fx.oldGym.name })).toHaveCount(0);
  });
});

test.describe("K1 check a venue's suitability", () => {
  test("K1-T12 roles other than Event Coordinator cannot check suitability", { tag: ["@K1", "@K1-T12"] }, async ({ page, a11y }) => {
    const venue = await createVenue({ name: uniqueName("K1 Test Hall") });
    const event = await approvedRequest({ name: uniqueName("K1-E-FIT") });
    const path = `/venue/api/v1/venues/${venue.id}/suitability?eventId=${event.id}`;

    for (const role of ["organiser", "venuestaff", "techsupport"] as const) {
      await signIn(page, role);
      await openVenues(page);
      await venueRow(page, venue.name).getByRole("link", { name: "View" }).click();
      await expect(page.getByRole("heading", { name: venue.name, level: 2 })).toBeVisible();
      await expect(page.getByRole("button", { name: "Check suitability" })).toHaveCount(0);
      await page.goto(`/#/venues/${venue.id}/suitability`);
      await expect(page.getByText("Suitability for an event")).toHaveCount(0);
      await expect(page.getByLabel("Event", { exact: true })).toHaveCount(0);
      await consoleRefuses(page, path);
      await a11y(`direct API console refusal (${role})`);
      await page.getByRole("button", { name: "Sign out" }).click();
    }

    // Attendees have no venue screens at all, so only the API is left to them.
    await signIn(page, "attendee");
    await expect(page.getByRole("navigation").getByRole("link", { name: "Venues" })).toHaveCount(0);
    await consoleRefuses(page, path);

    // Nothing was assessed for anyone: the same call as the coordinator does answer.
    const allowed = await call("coordinator", "GET", path.replace("/venue", ""));
    expect(allowed.status).toBe(200);
  });
});

/** Sends GET <path> from the API console and checks it is refused as not authorised, with no assessment. */
async function consoleRefuses(page: Page, path: string) {
  await page.goto("/#/console");
  await expect(page.getByRole("heading", { name: "Direct API console" })).toBeVisible();
  await page.getByLabel("Method").fill("GET");
  await page.getByLabel("Path").fill(path);
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByRole("heading", { name: /^403/ })).toBeVisible();
  const body = page.locator("pre");
  await expect(body).toContainText('"code": "ROLE_NOT_AUTHORISED"');
  await expect(body).toContainText("Your role is not authorised to use this function.");
  await expect(body).not.toContainText('"status"');
  await expect(body).not.toContainText('"reasons"');
}
