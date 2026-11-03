# EN-14 — Accessibility findings (axe)

Every screen a browser journey visits is checked with axe (`@axe-core/playwright` 4.13, rules tagged
WCAG 2.1 A and AA). A serious or critical violation fails the test, and no rule is switched off to make
one pass. Every violation, whatever its impact, is written to `tests/test-results/axe-findings/` and
listed in the `e2e` job's summary.

**Evidence run:** [run 41513983925](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925) on commit 6080462: 101 test runs passed (83 journeys at 1280 px, 6 visual tests at each of 3 widths), none flaky, no axe violation.

## Found and fixed in this pull request

Each was a real violation that failed a journey until fixed.

| # | Rule, impact | Where | Cause | Fix |
|---|---|---|---|---|
| 1 | `color-contrast`, serious | Sign-in screen, the seeded-account links | #0C66E4 on the information panel, below 4.5:1 | #0055CC (`Login.tsx`) |
| 2 | `label`, critical | New event request / draft form, every field | labels not tied to their inputs | `Field` gives each input an id and the label `htmlFor` (`DraftEditor.tsx`) |
| 3 | `label`, critical | Direct API console: Method, Path, Body | as above | ids and `htmlFor` (`ApiConsole.tsx`) |
| 4 | `label`, critical | Organiser's request page, "Amend expected attendance" while a clarification is open | as above | id and `htmlFor` (`RequestDetail.tsx`) |
| 5 | `color-contrast`, serious | Every red status lozenge: Rejected, Cancelled, Confirmed on the calendar, Requires reconfirmation | Atlaskit's subtle "removed" lozenge, #DE350B on #FFEBE6, 3.95:1 | a shared `Lozenge` uses Atlaskit's own bold variant for that appearance (`shared/Lozenge.tsx`; every screen imports it) |
| 6 | `color-contrast`, serious | "Remove line" (equipment request), "Release hold" and "Withdraw request" dialogs | Atlaskit's danger button, white on #DD3A10, 4.29:1 | the warning button the app already uses for Reject (`EquipmentRequest.tsx`, `EventVenueRequests.tsx`) |

A seventh report, colour contrast inside a dialog, was not a defect: axe had read the dialog half-way
through its fade-in. The check now waits for finite animations to finish before it runs.

## Still open

None that axe reports on the screens the journeys visit. Two things it can't see, from the visual snapshots:

- **The staff console doesn't reflow at 360 px.** The header and the two-column screens are wider than the
  viewport, so the page scrolls sideways (WCAG 1.4.10). The attendee app is the mobile surface (ADR-0014),
  but the console isn't usable on a phone; a reviewer should decide whether that matters for the showcase.
- Screens no journey opens (the Lead's assignment screens, notifications, hold expiry) were not checked.
