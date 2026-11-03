import type { Locator, Page } from "@playwright/test";
import { expect, signIn, test, uniqueName } from "./support/fixtures.js";
import { must } from "./support/api.js";
import { approvedRequest, createVenue, type VenueRow } from "./support/seed.js";
import { shownAs } from "./support/seed-events.js";
import { eventBookings, eventHolds, requestBooking } from "./support/seed-venues.js";
import {
  DAYS,
  fxCommitments,
  fxVenues,
  k1Event,
  k1Venue,
  localInput,
  sgt,
  venueArrangements,
  type FxVenues,
} from "./support/seed-search.js";

/**
 * Venue search (J1, J2), the suitability check (K1), the booking queue's unsuitability record (M1)
 * and cancelling an event's venue arrangements (L4), through the real screens. Each journey makes
 * its own copy of the cards' FX venues (tests/J1/README.md), with a suffix on every name and
 * building, and judges only the rows carrying its suffix. The cards' December 2026 days move to
 * March 2027 on the same weekdays (see support/seed-search.ts).
 */

const nav = (page: Page) => page.getByRole("navigation");
const results = (page: Page) => page.getByRole("region", { name: "Results" });
const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });
const monday = (time: string) => localInput(DAYS.monday, time);

async function openSearch(page: Page) {
  await nav(page).getByRole("link", { name: "Find a venue" }).click();
  await expect(page.getByRole("heading", { name: "Find a venue" })).toBeVisible();
}

/** Waits for two painted frames, so a response that has just arrived is what the screen shows. */
const painted = (page: Page) =>
  page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));

/** Clicks Search and waits for the server's answer to this search, whatever it is. */
async function search(page: Page) {
  const answered = page.waitForResponse(
    (response) => response.request().method() === "GET" && new URL(response.url()).pathname.endsWith("/api/v1/venues/search"),
  );
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await answered;
  await painted(page);
}

async function setWindow(page: Page, from: string, to: string) {
  await field(page, "From").fill(from);
  await field(page, "To").fill(to);
}

/** The names, sorted, of the listed venues that belong to this run. */
async function ownRows(page: Page, fx: FxVenues): Promise<string[]> {
  const names = await results(page).locator("tbody tr td:first-child a").allInnerTexts();
  return names.filter((name) => name.includes(fx.suffix)).sort();
}

async function expectOwn(page: Page, fx: FxVenues, ...venues: VenueRow[]) {
  await expect.poll(() => ownRows(page, fx)).toEqual(venues.map((venue) => venue.name).sort());
}

/** No venue of this run is listed, no table is shown, and the empty-result message is. */
async function expectNoMatch(page: Page, fx: FxVenues) {
  await expect(results(page).getByText("No venues match")).toBeVisible();
  await expect(results(page).getByRole("table")).toHaveCount(0);
  expect(await ownRows(page, fx)).toEqual([]);
}

const accessibility = (page: Page) => page.getByRole("group", { name: "Accessibility features" });
const facilities = (page: Page) => page.getByRole("group", { name: "Facilities" });

async function openFromAllEvents(page: Page, name: string) {
  await nav(page).getByRole("link", { name: "All events" }).click();
  await page.getByRole("row").filter({ hasText: name }).getByRole("link", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name, level: 2 })).toBeVisible();
}

async function openVenue(page: Page, venue: VenueRow) {
  await nav(page).getByRole("link", { name: "Venues", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Venues", exact: true })).toBeVisible();
  await page.getByRole("row").filter({ hasText: venue.name }).getByRole("link", { name: "View" }).click();
  await expect(page.getByRole("heading", { name: venue.name, level: 2 })).toBeVisible();
}

test.describe("J1 filter venues against event requirements", () => {
  test("J1-T3 boundary: a minimum capacity equal to a venue's maximum keeps it, and one more drops it", { tag: ["@J1", "@J1-T3"] }, async ({ page, a11y }) => {
    const fx = await fxVenues();
    await signIn(page, "coordinator");
    await openSearch(page);
    // Besides the card's steps, the building filter holds this run's suffix, so only its own venues can be listed.
    await field(page, "Building / location").fill(fx.suffix);

    const steps: [string, VenueRow[]][] = [
      ["200", [fx.auditorium, fx.lectureHall]],
      ["201", [fx.auditorium]],
      ["300", [fx.auditorium]],
    ];
    for (const [capacity, expected] of steps) {
      await field(page, "Minimum capacity").fill(capacity);
      await search(page);
      await expectOwn(page, fx, ...expected);
    }
    await a11y("search results at capacity 300");

    await field(page, "Minimum capacity").fill("301");
    await search(page);
    await expectNoMatch(page, fx);
    await expect(results(page)).toContainText("minimum capacity 301");
  });

  test("J1-T6 the building filter keeps only venues there, ignoring case", { tag: ["@J1", "@J1-T6"] }, async ({ page }) => {
    const fx = await fxVenues();
    await signIn(page, "coordinator");
    await openSearch(page);

    // The card's `science` and `FX ARTS BUILDING`, with this run's suffix so other runs' buildings don't match.
    await field(page, "Building / location").fill(`science block ${fx.suffix.toLowerCase()}`);
    await search(page);
    await expectOwn(page, fx, fx.auditorium, fx.seminar);

    await field(page, "Building / location").fill(fx.arts.toUpperCase());
    await search(page);
    await expectOwn(page, fx, fx.lectureHall);
    await expect(results(page).getByRole("link", { name: fx.oldGym.name })).toHaveCount(0);

    await field(page, "Building / location").fill("Nowhere Hall");
    await search(page);
    await expectNoMatch(page, fx);
    await expect(results(page)).toContainText('building or location containing "Nowhere Hall"');
  });

  test("J1-T9 every required accessibility feature must be present", { tag: ["@J1", "@J1-T9"] }, async ({ page }) => {
    const fx = await fxVenues();
    await signIn(page, "coordinator");
    await openSearch(page);
    await field(page, "Building / location").fill(fx.suffix);

    await accessibility(page).getByLabel("Hearing loop", { exact: true }).check({ force: true });
    await search(page);
    await expectOwn(page, fx, fx.auditorium, fx.lectureHall);

    await accessibility(page).getByLabel("Hearing loop", { exact: true }).uncheck({ force: true });
    await accessibility(page).getByLabel("Accessible toilet", { exact: true }).check({ force: true });
    await search(page);
    await expectOwn(page, fx, fx.lectureHall);

    await accessibility(page).getByLabel("Step-free access", { exact: true }).check({ force: true });
    await accessibility(page).getByLabel("Hearing loop", { exact: true }).check({ force: true });
    await search(page);
    await expectOwn(page, fx, fx.lectureHall);
  });

  test("J1-T13 recorded unavailability excludes a venue; a released slot and a removed block do not", { tag: ["@J1", "@J1-T13"] }, async ({ page, a11y }) => {
    const fx = await fxVenues();
    await fxCommitments(fx);
    await signIn(page, "coordinator");
    await openSearch(page);
    await field(page, "Building / location").fill(fx.arts);
    await a11y("find a venue");

    await setWindow(page, monday("10:00"), monday("11:00"));
    await search(page);
    await expectNoMatch(page, fx);

    await setWindow(page, monday("15:30"), monday("16:30"));
    await search(page);
    await expectOwn(page, fx, fx.lectureHall);

    await setWindow(page, localInput(DAYS.wednesday, "10:00"), localInput(DAYS.wednesday, "11:00"));
    await search(page);
    await expectOwn(page, fx, fx.lectureHall);
    await expect(results(page).getByRole("link", { name: fx.oldGym.name })).toHaveCount(0);
  });

  test("J1-T15 a venue closed during the window is excluded", { tag: ["@J1", "@J1-T15"] }, async ({ page }) => {
    const fx = await fxVenues();
    await signIn(page, "coordinator");
    await openSearch(page);
    await field(page, "Building / location").fill(fx.suffix);

    const windows: [string, string, string][] = [
      [localInput(DAYS.sunday, "10:00"), localInput(DAYS.sunday, "12:00"), "Sunday, when every venue is closed"],
      [monday("07:00"), monday("09:00"), "Monday before opening"],
      [monday("21:00"), localInput(DAYS.tuesday, "09:00"), "Monday night into Tuesday, closed overnight"],
    ];
    for (const [from, to] of windows) {
      await setWindow(page, from, to);
      await search(page);
      await expectNoMatch(page, fx);
    }
  });

  test("J1-T19 inactive venues are excluded", { tag: ["@J1", "@J1-T19"] }, async ({ page }) => {
    const fx = await fxVenues();
    await signIn(page, "coordinator");
    await openSearch(page);
    await field(page, "Building / location").fill(fx.suffix);

    await field(page, "Minimum capacity").fill("400");
    await search(page);
    await expectNoMatch(page, fx);
    await expect(results(page).getByRole("link", { name: fx.oldGym.name })).toHaveCount(0);
    await expect(results(page)).toContainText("minimum capacity 400");
  });

  test("J1-T21 opened from an event, the filters are pre-filled from its recorded requirements", { tag: ["@J1", "@J1-T21"] }, async ({ page, a11y }) => {
    const fx = await fxVenues();
    await fxCommitments(fx);
    const event = await symposium();
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);
    await page.locator("aside").getByRole("link", { name: "Find a venue" }).click();
    await expect(page.getByRole("heading", { name: "Find a venue" })).toBeVisible();

    await expect(field(page, "From")).toHaveValue(monday("12:00"));
    await expect(field(page, "To")).toHaveValue(monday("14:00"));
    await expect(field(page, "Minimum capacity")).toHaveValue("150");
    await expect(field(page, "Layout")).toHaveValue("Theatre");
    await expect(facilities(page).getByLabel("Projector", { exact: true })).toBeChecked();
    await expect(facilities(page).getByLabel("Wireless microphones", { exact: true })).toBeChecked();
    await expect(facilities(page).getByRole("checkbox", { checked: true })).toHaveCount(2);
    await expect(accessibility(page).getByLabel("Step-free access", { exact: true })).toBeChecked();
    await expect(accessibility(page).getByLabel("Hearing loop", { exact: true })).toBeChecked();
    await expect(accessibility(page).getByRole("checkbox", { checked: true })).toHaveCount(2);
    await expect(page.getByText("Not matched to a catalogue feature")).toBeVisible();
    await expect(page.getByText("The event also asks for Reserved seating.")).toBeVisible();
    await expectOwn(page, fx, fx.auditorium);
    await a11y("find a venue, pre-filled from an event");
  });

  test("J1-T22 pre-filled filters remain editable", { tag: ["@J1", "@J1-T22"] }, async ({ page }) => {
    const fx = await fxVenues();
    await fxCommitments(fx);
    const event = await symposium();
    await signIn(page, "coordinator");
    await openFromAllEvents(page, event.name);
    await page.locator("aside").getByRole("link", { name: "Find a venue" }).click();
    await expect(field(page, "Layout")).toHaveValue("Theatre");
    await expectOwn(page, fx, fx.auditorium);

    await field(page, "Layout").selectOption({ label: "Any layout" });
    await field(page, "Minimum capacity").fill("50");
    await facilities(page).getByLabel("Wireless microphones", { exact: true }).uncheck({ force: true });
    await accessibility(page).getByLabel("Hearing loop", { exact: true }).uncheck({ force: true });
    await expect(field(page, "Layout")).toHaveValue("");
    await expect(field(page, "Minimum capacity")).toHaveValue("50");
    await expect(facilities(page).getByLabel("Wireless microphones", { exact: true })).not.toBeChecked();
    await expect(accessibility(page).getByLabel("Hearing loop", { exact: true })).not.toBeChecked();
    await search(page);

    await expectOwn(page, fx, fx.auditorium, fx.seminar, fx.lateStudio);
    await expect(results(page).getByRole("link", { name: fx.lectureHall.name })).toHaveCount(0);
  });

  test("J1-T23 a window with one end, or ending before it starts, is refused naming the field", { tag: ["@J1", "@J1-T23"] }, async ({ page, a11y }) => {
    await signIn(page, "coordinator");
    await openSearch(page);
    await expect(results(page)).toBeVisible();
    const toError = page.locator("#venue-search-to-error");
    const summary = page.getByText("The venues could not be searched. Check the highlighted fields.");

    await field(page, "From").fill(monday("12:00"));
    await search(page);
    await expect(toError).toHaveText("Enter when the window ends, as well as when it starts.");
    await expect(summary).toBeVisible();
    await expect(page.locator("#venue-search-from-error")).toHaveCount(0);
    await expect(results(page)).toHaveCount(0);
    await a11y("search refused, one end of the window");

    await field(page, "To").fill(monday("11:00"));
    await search(page);
    await expect(toError).toHaveText("The window must end after it starts.");
    await expect(summary).toBeVisible();
    await expect(results(page)).toHaveCount(0);

    await field(page, "To").fill(monday("12:00"));
    await search(page);
    await expect(toError).toHaveText("The window must end after it starts.");
    await expect(summary).toBeVisible();
    await expect(results(page)).toHaveCount(0);
  });

  test("J1-T24 only Event Coordinators can search; every other role is refused by the server", { tag: ["@J1", "@J1-T24"] }, async ({ page, a11y }) => {
    const path = "/venue/api/v1/venues/search";
    for (const role of ["organiser", "venuestaff", "techsupport", "attendee"] as const) {
      await signIn(page, role);
      await expect(nav(page).getByRole("link", { name: "Find a venue" })).toHaveCount(0);
      await sendFromConsole(page, path);
      await expect(page.getByRole("heading", { name: /^403/ })).toBeVisible();
      await expect(page.locator("pre")).toContainText('"code": "ROLE_NOT_AUTHORISED"');
      await expect(page.locator("pre")).not.toContainText('"items"');
      await a11y(`search refused (${role})`);
      await page.getByRole("button", { name: "Sign out" }).click();
    }

    await signIn(page, "coordinator");
    await expect(nav(page).getByRole("link", { name: "Find a venue" })).toBeVisible();
    await sendFromConsole(page, path);
    await expect(page.getByRole("heading", { name: /^200/ })).toBeVisible();
    await expect(page.locator("pre")).toContainText('"items": [');
  });

  /**
   * J1-T18 asserts the card whole. The search does not widen the window by a venue's own setup and
   * turnaround time yet (repo/venueSearch.ts still adds 0 minutes, "until H3 lands"), so the first
   * search returns FX Seminar Room as well and the test is expected to fail: it is the evidence of
   * that defect. The `observed` annotation holds what the screen listed.
   */
  test("J1-T18 the requested window is widened by the venue's own setup and turnaround time", { tag: ["@J1", "@J1-T18"] }, async ({ page }, testInfo) => {
    test.fail(true, "Defect: the search widens the window by 0 minutes, not by the venue's own setup and turnaround time (CR-01, H3).");
    const fx = await fxVenues();
    await fxCommitments(fx);

    await signIn(page, "venuestaff");
    await page.goto(`/#/venues/${fx.seminar.id}/edit`);
    await expect(page.getByRole("heading", { name: "Edit venue" })).toBeVisible();
    await field(page, "Setup time (minutes)").fill("30");
    await field(page, "Turnaround time (minutes)").fill("30");
    await page.getByRole("button", { name: "Save venue" }).click();
    await expect(page.getByText("Venue saved.")).toBeVisible();
    await page.getByRole("button", { name: "Sign out" }).click();

    await signIn(page, "coordinator");
    await openSearch(page);
    await field(page, "Building / location").fill(fx.science);
    await setWindow(page, monday("16:00"), monday("17:00"));
    await search(page);
    testInfo.annotations.push({ type: "observed 16:00-17:00", description: (await ownRows(page, fx)).join(" | ") });
    await expectOwn(page, fx, fx.auditorium);

    await setWindow(page, monday("16:30"), monday("17:30"));
    await search(page);
    await expectOwn(page, fx, fx.auditorium, fx.seminar);
  });
});

/** FX Symposium (tests/J1/README.md, FX-SEARCH-EVENT): Monday 12:00-14:00, 150 attending, Theatre with a projector and wireless microphones. */
function symposium() {
  return approvedRequest({
    name: uniqueName("FX Symposium"),
    proposedStartAt: sgt(DAYS.monday, "12:00"),
    proposedEndAt: sgt(DAYS.monday, "14:00"),
    expectedAttendance: 150,
    venueRequirements: { layout: "Theatre", facilities: ["Projector", "Wireless microphones"] },
    accessibilityNeeds: "Step-free access, Hearing loop, Reserved seating",
  });
}

/** Sends GET <path> from the API console, as the cards' "Open API console" steps do. */
async function sendFromConsole(page: Page, path: string) {
  // Attendees have no link to the console (it is reached by its address), so every role goes by the address.
  await page.goto("/#/console");
  await expect(page.getByRole("heading", { name: "Direct API console" })).toBeVisible();
  await page.getByLabel("Method").fill("GET");
  await page.getByLabel("Path").fill(path);
  await page.getByRole("button", { name: "Send", exact: true }).click();
  await expect(page.locator("pre")).toBeVisible();
}

test.describe("J2 text search", () => {
  test("J2-T4 the text search combined with J1's filters returns only venues satisfying both", { tag: ["@J2", "@J2-T4"] }, async ({ page }) => {
    const fx = await fxVenues();
    await fxCommitments(fx);
    await signIn(page, "coordinator");
    await openSearch(page);

    // The card's `fx science`, with this run's suffix so other runs' venues don't match.
    const text = `fx science block ${fx.suffix.toLowerCase()}`;
    await field(page, "Search by name or building").fill(text);
    await field(page, "Minimum capacity").fill("100");
    await search(page);
    await expectOwn(page, fx, fx.auditorium);

    await accessibility(page).getByLabel("Hearing loop", { exact: true }).check({ force: true });
    await search(page);
    await expectOwn(page, fx, fx.auditorium);

    await setWindow(page, monday("10:30"), monday("11:30"));
    await search(page);
    await expectNoMatch(page, fx);
    await expect(results(page)).toContainText(
      `No active venue matches all of these filters: name or building containing "${text}"; available from 2027-03-08 10:30 to 2027-03-08 11:30 (Singapore time); minimum capacity 100; accessibility features Hearing loop.`,
    );
  });

  test("J2-T7 boundary: spaces only, a single character, and the wildcard characters % and _", { tag: ["@J2", "@J2-T7"] }, async ({ page }) => {
    const fx = await fxVenues();
    await signIn(page, "coordinator");
    await openSearch(page);
    const q = field(page, "Search by name or building");

    await q.fill("   ");
    await search(page);
    await expectOwn(page, fx, ...fx.active);
    await expect(results(page).getByText("No venues match")).toHaveCount(0);
    await expect(page.getByText("The venues could not be searched")).toHaveCount(0);
    await expect(page.getByRole("alert")).toHaveCount(0);

    await q.fill("x");
    await search(page);
    await expectOwn(page, fx, ...fx.active);
    await expectEveryRowContains(results(page), "x");

    for (const character of ["%", "_"]) {
      await q.fill(character);
      await search(page);
      await expect.poll(() => ownRows(page, fx)).toEqual([]);
      await expectEveryRowContains(results(page), character);
      await expect(page.getByText("The venues could not be searched")).toHaveCount(0);
    }
  });
});

/** Every listed venue's name or building contains the text (ignoring case), so the text was not read as a pattern. */
async function expectEveryRowContains(region: Locator, text: string) {
  const rows = await region.locator("tbody tr").evaluateAll((trs) =>
    trs.map((tr) => [...tr.querySelectorAll("td")].slice(0, 2).map((td) => td.textContent ?? "").join(" ")),
  );
  for (const row of rows) expect(row.toLowerCase(), `a listed venue: ${row}`).toContain(text.toLowerCase());
}

test.describe("K1 check a venue's suitability", () => {
  const suitability = (page: Page) => page.locator("section[aria-labelledby='suitability-result']");

  async function check(page: Page, venue: VenueRow, event: { name: string; reference: string }) {
    await openVenue(page, venue);
    await page.getByRole("button", { name: "Check suitability" }).click();
    await expect(page.getByText("Suitability for an event.")).toBeVisible();
    await page.getByLabel("Event", { exact: true }).selectOption({ label: `${event.reference} · ${event.name}` });
    await page.getByRole("button", { name: "Check suitability" }).click();
    await expect(suitability(page)).toBeVisible();
  }

  async function openAvailability(page: Page, venue: VenueRow) {
    await openVenue(page, venue);
    await page.getByRole("button", { name: "Availability" }).click();
    await expect(page.getByText("Availability. Times are Singapore time.")).toBeVisible();
    await field(page, "From").fill(DAYS.monday);
    await field(page, "To").fill("2027-03-14");
    await page.getByRole("button", { name: "Show" }).click();
    await expect(page.getByRole("region", { name: "Sunday 14 March 2027" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Monday 8 March 2027" })).toBeVisible();
    return page.locator("main").innerText();
  }

  test("K1-T9 the check offers only which event to assess, and every value it compares comes from the records", { tag: ["@K1", "@K1-T9"] }, async ({ page, a11y }) => {
    const venue = await k1Venue();
    const big = await k1Event("K1-E-BIG", { expectedAttendance: 150 });
    await signIn(page, "coordinator");

    // 1. The event's attendance, layout and period.
    await openFromAllEvents(page, big.name);
    const main = page.locator("main");
    await expect(main.getByText("150", { exact: true })).toBeVisible();
    await expect(main.getByText("Room layout: Theatre")).toBeVisible();
    await expect(main.getByText(await shownAs(page, sgt(DAYS.monday, "10:00")), { exact: true })).toBeVisible();
    await expect(main.getByText(await shownAs(page, sgt(DAYS.monday, "12:00")), { exact: true })).toBeVisible();

    // 2. The venue's layouts, facilities, features and hours.
    await openVenue(page, venue);
    await expect(page.getByRole("region", { name: "Layouts" }).getByRole("row", { name: "Theatre 120" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Layouts" }).getByRole("row", { name: "Classroom 60" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Facilities" }).getByRole("listitem")).toHaveText(["Projector", "Microphone", "Livestream"]);
    await expect(page.getByRole("region", { name: "Accessibility features" }).getByRole("listitem")).toHaveText(["Step-free entrance", "Hearing loop"]);
    await expect(page.getByRole("region", { name: "Operating hours" }).getByRole("row", { name: "Monday 08:00–22:00" })).toBeVisible();

    // 3. Run the check.
    await page.getByRole("button", { name: "Check suitability" }).click();
    await expect(page.getByText("Suitability for an event.")).toBeVisible();
    await page.getByLabel("Event", { exact: true }).selectOption({ label: `${big.reference} · ${big.name}` });
    await a11y("suitability check, event chosen");
    await page.getByRole("button", { name: "Check suitability" }).click();
    const result = suitability(page);
    await expect(result).toContainText("Not suitable");
    await expect(result.getByRole("list", { name: "Reasons" }).getByRole("listitem")).toHaveText([
      "Expected attendance 150 against layout capacity 120 (Theatre).",
    ]);
    await expect(result.getByRole("heading", { name: "Warnings" })).toHaveCount(0);
    await a11y("suitability result");

    // 4. The only choice is the event: no field takes an attendance, layout, facility or period.
    await expect(main.locator("input, textarea")).toHaveCount(0);
    await expect(main.getByRole("combobox")).toHaveCount(1);
    await expect(main.getByRole("combobox")).toHaveAccessibleName("Event");
    await expect(main.getByLabel(/attendance|layout|facilit|period|date|time/i)).toHaveCount(0);
  });

  test("K1-T10 the check is advisory: it creates, changes and blocks no booking", { tag: ["@K1", "@K1-T10"] }, async ({ page, a11y }) => {
    const venue = await k1Venue();
    const wrong = await k1Event("K1-E-ALLWRONG", {
      expectedAttendance: 150,
      venueRequirements: { layout: "Theatre", facilities: ["Simultaneous interpretation"] },
      accessibilityNeeds: "Braille signage",
      proposedStartAt: sgt(DAYS.monday, "07:00"),
      proposedEndAt: sgt(DAYS.monday, "09:00"),
    });
    const fit = await k1Event("K1-E-FIT", {
      venueRequirements: { layout: "Theatre", facilities: ["Projector"] },
      accessibilityNeeds: "Hearing loop",
    });
    const recordOf = (id: string) => must("coordinator", "GET", `/api/v1/events/${id}`);
    const before = { wrong: await recordOf(wrong.id), fit: await recordOf(fit.id) };
    await signIn(page, "coordinator");

    // 1. The venue's availability for the week, noted.
    const availabilityBefore = await openAvailability(page, venue);

    // 2. The check for K1-E-ALLWRONG (Not suitable) and for K1-E-FIT (Suitable).
    await check(page, venue, wrong);
    await expect(suitability(page)).toContainText("Not suitable");
    await expect(suitability(page).getByRole("list", { name: "Reasons" }).getByRole("listitem")).toHaveCount(4);
    await expectAdvisoryOnly(page);
    await a11y("suitability result, not suitable");
    await check(page, venue, fit);
    await expect(suitability(page)).toContainText("Suitable");
    await expect(suitability(page)).not.toContainText("Not suitable");
    await expect(suitability(page).getByRole("heading", { name: "Reasons" })).toHaveCount(0);
    await expectAdvisoryOnly(page);

    // 3. The same dates again.
    expect(await openAvailability(page, venue)).toBe(availabilityBefore);
    for (const event of [wrong, fit]) {
      expect((await eventBookings(event.id)).items).toEqual([]);
      expect((await eventBookings(event.id)).bookings).toEqual([]);
      expect((await eventHolds(event.id)).items).toEqual([]);
    }

    // 4. Each event, as before.
    for (const event of [wrong, fit]) {
      await openFromAllEvents(page, event.name);
      await expect(page.locator("aside").filter({ has: page.getByRole("heading", { name: "Status" }) })).toContainText("Approved");
    }
    expect({ wrong: await recordOf(wrong.id), fit: await recordOf(fit.id) }).toEqual(before);
  });

  /** The result screen's only controls are the check itself and the way back: nothing books, holds, requests or blocks. */
  async function expectAdvisoryOnly(page: Page) {
    const main = page.locator("main");
    await expect(main.getByRole("button")).toHaveText(["Check suitability", "Back to venue"]);
    await expect(main.getByRole("link")).toHaveCount(0);
  }
});

test.describe("M1 the booking queue", () => {
  test("M1-T2 the queue shows the unsuitability justification and the failing conditions recorded with the request", { tag: ["@M1", "@M1-T2"] }, async ({ page, a11y }) => {
    const venue = await createVenue();
    const event = await approvedRequest();
    const justification = "The only hall free that week";
    const request = await requestBooking(event.id, venue.id, {
      expectedAttendance: 350,
      facilities: ["Livestream"],
      justification,
    });
    // The failing conditions as they were evaluated when the request was made, which the server stored with it.
    const stored = (await eventBookings(event.id)).items.find((item) => item.id === request.id) as unknown as
      | { suitabilityStatus: string; suitabilityReasons: { message: string }[]; justification: string }
      | undefined;
    expect(stored?.suitabilityStatus).toBe("NOT_SUITABLE");
    const reasons = stored!.suitabilityReasons.map((reason) => reason.message);
    expect(reasons).toEqual([
      "Expected attendance 350 against layout capacity 300 (Theatre).",
      `Required facility absent: Livestream. The venue offers: ${(venue.facilities as string[]).join(", ")}.`,
    ]);

    await signIn(page, "venuestaff");
    await nav(page).getByRole("link", { name: "Booking requests", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Booking requests", level: 2 })).toBeVisible();

    const row = page.getByRole("row", { name: request.reference });
    await expect(row).toContainText("Not suitable");
    for (const message of reasons) await expect(row.getByRole("listitem").filter({ hasText: message })).toHaveCount(1);
    await expect(row).toContainText(`Justification: ${justification}`);
    await a11y("booking requests queue with an unsuitable request");
  });
});

test.describe("L4 several venues for one event", () => {
  test("L4-T9 cancelling the event releases its booking and hold, withdraws its request, and frees all three venues", { tag: ["@L4", "@L4-T9"] }, async ({ page, a11y }) => {
    const arranged = await venueArrangements();
    const { event } = arranged;
    await signIn(page, "coordinator");

    // 1. Cancel the event.
    await openFromAllEvents(page, event.name);
    await page.getByRole("button", { name: "Cancel event" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Reason").fill("The speaker withdrew.");
    await dialog.getByRole("button", { name: "Cancel event" }).click();
    await expect(page.getByRole("heading", { name: "This event was cancelled" })).toBeVisible();

    // 2. The event's venue requests: the booking and the hold are Released, the request is Withdrawn.
    await page.getByRole("link", { name: "Venue requests" }).click();
    await expect(page.getByRole("heading", { name: "Venue requests" })).toBeVisible();
    const { bookings } = await eventBookings(event.id);
    const booking = bookings.find((candidate) => candidate.venueId === arranged.confirmedAt.id)!;
    const hold = (await eventHolds(event.id)).items.find((candidate) => candidate.id === arranged.hold.id)!;
    await expect(page.getByRole("table", { name: "Bookings" }).getByRole("row", { name: booking.reference })).toContainText("Released");
    await expect(page.getByRole("table", { name: "Holds" }).getByRole("row", { name: hold.reference })).toContainText("Released");
    await expect(page.getByRole("row", { name: arranged.pending.reference })).toContainText("Withdrawn");
    await a11y("venue requests after the event was cancelled");

    // ... and each venue is free from 14:00 to 18:00 on the day.
    for (const venue of [arranged.confirmedAt, arranged.heldAt, arranged.requestedAt]) {
      await nav(page).getByRole("link", { name: "Venues", exact: true }).click();
      await page.getByRole("row").filter({ hasText: venue.name }).getByRole("link", { name: "View" }).click();
      await page.getByRole("button", { name: "Availability" }).click();
      await expect(page.getByText("Availability. Times are Singapore time.")).toBeVisible();
      await field(page, "From").fill("2027-03-02");
      await field(page, "To").fill("2027-03-02");
      await page.getByRole("button", { name: "Show" }).click();
      const tuesday = page.getByRole("region", { name: "Tuesday 2 March 2027" });
      await expect(tuesday).toBeVisible();
      await expect(tuesday.getByRole("list", { name: "Free" }).getByRole("listitem")).toHaveText(["08:00–22:00"]);
      await expect(tuesday.getByRole("list", { name: "Committed" }).getByRole("listitem").filter({ hasText: event.reference })).toHaveCount(0);
    }
  });
});
