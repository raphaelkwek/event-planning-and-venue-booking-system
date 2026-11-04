import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "../src/shell/AppShell.js";
import { ThemeProvider } from "../src/theme/ThemeProvider.js";

/**
 * Staff navigation on a phone (360 and 375 px). A hidden-scrollbar strip left most of a role's
 * screens past the edge of the screen, reachable only by an invisible swipe. Below 960 px the rail
 * now wraps onto more rows, so every item is on show and the page never scrolls sideways.
 *
 * jsdom does no layout, so the layout rules are asserted on the stylesheet itself; the same rules
 * were measured in Chromium at 360, 375 and 768 px (page width equals the viewport, no item off
 * the right edge) when this was fixed.
 */

const SHELL_CSS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/shell/shell.css"), "utf8").replace(/\r\n/g, "\n");

/** The text of the rules inside the `@media (max-width: <width>)` block, found by matching braces. */
function mediaBlock(width: string): string {
  const start = SHELL_CSS.indexOf(`@media (max-width: ${width})`);
  expect(start, `no @media (max-width: ${width}) block`).toBeGreaterThanOrEqual(0);
  let depth = 0;
  for (let i = SHELL_CSS.indexOf("{", start); i < SHELL_CSS.length; i += 1) {
    if (SHELL_CSS[i] === "{") depth += 1;
    if (SHELL_CSS[i] === "}" && --depth === 0) return SHELL_CSS.slice(SHELL_CSS.indexOf("{", start) + 1, i);
  }
  throw new Error("unbalanced braces");
}

/** The declarations of one selector's rule inside a block. */
function declarations(block: string, selector: string): string {
  const escaped = selector.replace(/[.]/g, String.raw`\.`);
  const match = new RegExp(String.raw`(?:^|\n)\s*${escaped}\s*\{([^}]*)\}`).exec(block);
  expect(match, `no ${selector} rule`).not.toBeNull();
  return match![1]!;
}

const NAV = [
  "My requests",
  "New request",
  "Review queue",
  "All events",
  "Booking requests",
  "Hold requests",
  "Venues",
  "Find a venue",
  "Equipment",
  "Equipment availability",
  "Equipment requests",
  "Unassigned",
  "Assignments",
  "Safety queue",
  "Notifications",
  "API console",
].map((label) => ({ label, to: `/${label.toLowerCase().replace(/\s+/g, "-")}` }));

afterEach(cleanup);

describe("staff navigation on a phone", () => {
  const narrow = mediaBlock("959.98px");

  it("wraps the rail onto more rows instead of scrolling it sideways", () => {
    const rail = declarations(narrow, ".cs-rail");
    expect(rail).toMatch(/flex-wrap:\s*wrap/);
    expect(rail).not.toMatch(/overflow-x:\s*(auto|scroll)/);
    expect(rail).not.toMatch(/scrollbar-width:\s*none/);
  });

  it("lets each group and its list wrap too, and does not hide the labels' links", () => {
    expect(declarations(narrow, ".cs-rail__group")).toMatch(/flex-wrap:\s*wrap/);
    expect(declarations(narrow, ".cs-rail__list")).toMatch(/flex-wrap:\s*wrap/);
    expect(narrow).not.toMatch(/\.cs-rail__link\s*\{[^}]*display:\s*none/);
  });

  it("lets the signed-in line wrap, so the role is not clipped behind a long email at 360 px", () => {
    expect(declarations(narrow, ".cs-user__id")).toMatch(/white-space:\s*normal/);
  });

  it("renders every screen the role may open as a link in the primary navigation", () => {
    render(
      <MemoryRouter initialEntries={["/review-queue"]}>
        <ThemeProvider>
          <AppShell email="coordinator.with.a.long.address@connectsphere.test" roleLabel="Event Coordinator" nav={NAV} patterns={NAV.map((i) => i.to)} unread={null} onSignOut={() => undefined}>
            <p>Body</p>
          </AppShell>
        </ThemeProvider>
      </MemoryRouter>
    );
    const links = within(screen.getByRole("navigation", { name: "Primary" })).getAllByRole("link");
    // The rail groups the screens by section, so the order differs; none may be missing.
    expect(links.map((link) => link.textContent).sort()).toEqual(NAV.map((item) => item.label).sort());
  });
});
