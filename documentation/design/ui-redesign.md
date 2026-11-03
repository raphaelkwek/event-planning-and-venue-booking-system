# The operations-console redesign of the web app

**Author:** Joash · **Date:** 3 November 2026 · **Pull request:** #97

ConnectSphere's staff console now looks like what it is: an operations console for people who
review, book and equip events all day. The default is a dark theme, with a light theme designed
alongside it. This page records the direction, the tokens, how type and colour are used, and how to
add a screen so that it matches.

The look takes its spirit from intelligence and mission-control software (Palantir's product
language, and open-source consoles such as OSIRIS and God's Eye View): near-black surfaces, stark
type, hairline rules, dense data shown with confidence, and colour used only when it means
something. No code, asset, logo or branding was taken from any of them.

## What changed, and what didn't

| Changed | Unchanged |
|---|---|
| The theme, through `@atlaskit/tokens` (`setGlobalTheme`) and our own tokens | Every Atlaskit component: themed, not replaced (implementation.md §7.1) |
| A new shell: command bar, rail, context line, Ctrl+K palette, theme switch | Routes, API calls, form fields, behaviour |
| Fonts: IBM Plex Sans and IBM Plex Mono, self-hosted, Latin only | Every user-visible text, label, role name and accessible name |
| Dense tables, stacked cards on phones, stacked detail screens below 768 px | The screen files: none was edited (one shared map, `status.ts`, was) |

The screens keep their markup. What they look like comes from five files, loaded in this order by
`frontend/src/main.tsx`:

| File | What it does |
|---|---|
| `src/theme/tokens.css` | Every colour, size and duration, once per theme (`<html data-cs-theme>`). |
| `src/theme/atlaskit.css` | Points Atlaskit's `--ds-*` tokens at ours, so its components match the shell. |
| `src/theme/base.css` | Element defaults: type, headings, links, focus, tables, definition lists. |
| `src/theme/legacy.css` | The legacy colour bridge (below). |
| `src/shell/shell.css` | The command bar, rail, palette, sign-in frame and the responsive rules. |

`ThemeProvider` (`src/theme/ThemeProvider.tsx`) defaults to dark, remembers the choice in
`localStorage` (`connectsphere.theme`), sets `data-cs-theme`, and calls `setGlobalTheme` so Atlaskit
loads its own light or dark values first. `atlaskit.css` then overrides the ones that carry the look.

## Direction

- **Dark by default.** Graphite surfaces, not blue-grey ones; the canvas is near black (`#08090B`).
- **Stark type.** High-contrast text, page titles set slightly condensed, small capital labels with
  wide tracking for sections, column headers and the rail.
- **Hairlines, not boxes.** One-pixel rules separate rows, sections and regions. Shadows appear only
  on overlays.
- **Colour means something.** The six status families are the only colour on most screens. The one
  accent marks focus, where you are, and links. Primary actions are "ink" (light on dark, dark on
  light), not the accent.
- **Data in mono.** References, counts, dates and times are set in IBM Plex Mono with tabular figures.
- **Texture where it orients.** A faint grid with a glow fades out behind every screen's title, and
  behind the sign-in panel.
- **Motion that explains.** A screen fades and lifts 6 px in when you move to another one (not when
  only its id changes); the palette rises in. Both use only opacity and transform, and both stop
  under `prefers-reduced-motion`.

## Tokens

All values are in `src/theme/tokens.css`. The light theme is designed, not inverted: paper-white
panels on a cool grey canvas, ink text, and a darker accent so it keeps its contrast on white.

### Surfaces and lines

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--cs-canvas` | `#08090B` | `#F3F4F6` | The page behind everything |
| `--cs-surface` | `#0D0F12` | `#FFFFFF` | Command bar, rail, table headers, cards |
| `--cs-surface-raised` | `#13161A` | `#F8F9FA` | Raised panels |
| `--cs-surface-overlay` | `#181C21` | `#FFFFFF` | Modals, the palette |
| `--cs-surface-sunken` | `#050607` | `#ECEEF1` | Code and wells |
| `--cs-surface-input` | `#0B0D10` | `#FFFFFF` | Form fields |
| `--cs-surface-hover` | `#171B20` | `#EEF0F3` | Row and item hover |
| `--cs-line` | `#1F242A` | `#E2E5E9` | Hairlines |
| `--cs-line-strong` | `#2E343C` | `#C9CED5` | Header rules, outlines |
| `--cs-line-input` | `#6B7480` | `#7A828D` | Field outlines (3:1, WCAG 1.4.11) |

### Text, ink and the accent

| Token | Dark | Light | Used for |
|---|---|---|---|
| `--cs-text` | `#ECEEF1` | `#0E1114` | Body text, titles |
| `--cs-text-subtle` | `#A8B0BB` | `#4A525C` | Secondary text, labels, the rail |
| `--cs-text-subtlest` | `#8A939E` | `#626A75` | Hints, placeholders, the context line |
| `--cs-ink` / `--cs-on-ink` | `#ECEEF1` / `#0A0B0D` | `#0E1114` / `#FFFFFF` | Primary buttons and inverted text |
| `--cs-accent` | `#46D2E0` | `#00818F` | Focus ring, the current rail item, the mark's node |
| `--cs-accent-text` | `#46D2E0` | `#00707E` | Links and counts |
| `--cs-accent-wash` | 10 % accent | 8 % accent | The current item, the palette's selection |

### Status

Each family has a text colour, its own background (the subtle lozenge), a bold fill (the bold
lozenge, read with `--cs-on-ink`) and a rule.

| Family | Lozenge appearance | Statuses | Dark text / bg / bold | Light text / bg / bold |
|---|---|---|---|---|
| neutral | `default` | Draft, Held, Withdrawn, Released, Removed | `#C9CFD6` / `#1C2026` / `#8A939E` | `#3D4550` / `#E7E9EC` / `#4A525C` |
| info | `inprogress` | Under Review, Planning, Safety Review, Setup | `#8DB8FF` / `#0E1B30` / `#5A95F5` | `#0B4FB3` / `#E3EEFF` / `#0B5FD6` |
| discovery | `new` | Submitted, Requested, Unavailable (calendar) | `#BFAEFF` / `#1B1631` / `#9B85F7` | `#5B3CC4` / `#EFEAFF` / `#6A4BD8` |
| warning | `moved` | Awaiting Clarification, Pending, Held (hold) | `#F4C35A` / `#261E0B` / `#E8AE35` | `#7A4A00` / `#FFF1D6` / `#F0B429` |
| danger | `removed` | Rejected, Cancelled, Expired, Unavailable (line) | `#FF9289` / `#2B1212` / `#F26D63` | `#B42318` / `#FDECEA` / `#C9372C` |
| success | `success` | Approved, Confirmed, Completed, Reserved, Free | `#6BD9A2` / `#0D2418` / `#3CBF7E` | `#136C3E` / `#E3F5EA` / `#1A7A50` |

Which status gets which appearance is still decided in one place, `src/shared/status.ts`
(implementation.md §7.1). The calendar's day bars read the same status tokens.

### Type, space, shape, motion

| Token | Value | Notes |
|---|---|---|
| `--cs-font-sans` | IBM Plex Sans Variable | UI text; width axis 75–100 % |
| `--cs-font-mono` | IBM Plex Mono 400, 500 | Ids, times, counts, labels in the chrome |
| `--cs-fs-title` | 26 px, 600, `--cs-stretch-title` 88 % | Page titles (`h2`) |
| `--cs-fs-body` / `--cs-fs-dense` | 14 px / 13 px | Body / tables and the rail |
| `--cs-fs-small` / `--cs-fs-label` | 12 px / 11 px | Small text / capital labels, tracked `0.08em` |
| `--cs-space-1` … `--cs-space-6` | 4, 8, 12, 16, 24, 32 px | |
| `--cs-radius-sm` / `--cs-radius` / `--cs-radius-lg` | 2 / 4 / 6 px | Atlaskit's radii follow |
| `--cs-header-h` / `--cs-rail-w` | 52 px / 216 px | |
| `--cs-ease`, `--cs-dur-fast`, `--cs-dur` | `cubic-bezier(0.2, 0.8, 0.2, 1)`, 120 ms, 200 ms | |

## Type and colour roles

- **Page title:** `h2`, Plex Sans 600, condensed. **Section:** `h3`, an 11 px capital label followed by
  a hairline rule. **Label over a value:** `dt` or a 12 px semibold label.
- **Mono:** anything a person compares or copies: references (`EVT-000124`), counts, dates and times.
  The shell marks table cells and `dd` values that hold one (`src/shell/tables.ts`), so screens don't
  have to.
- **Accent:** focus rings, the current rail item, links, the unread count. Never a fill for an action
  and never a status.
- **Ink:** the primary action on a screen (Approve, Sign in, Save).
- **Status colours:** only in lozenges, the calendar and refusal or notice panels.

## The shell

| Part | What it is |
|---|---|
| Command bar (`<header>`, the one banner) | The mark, the context line, a Ctrl+K hint, the environment badge, the unread count, the theme switch, and the signed-in "email · Role" with Sign out |
| Context line | The section and the fixed words of the route, such as `VENUES / AVAILABILITY`. Ids are left out, so it reads the same for every record. |
| Rail (`<nav>`, the one navigation) | The role's screens from App.tsx's route table, grouped by the first word of their path: events, venues, equipment, oversight, safety, system |
| Palette | Ctrl+K (⌘K on a Mac). Offers exactly the rail's links, filtered as you type. |
| Environment badge | `VITE_APP_ENV` when a deployment sets it, otherwise `dev`, `local` or `hosted` |
| Sign-in frame | A brand panel beside the unchanged sign-in screen. No banner and no navigation, as A1's tests expect. |

The shell adds no button but Sign out. Some screens' tests count every button on the page (K1's
"offers no way to request, hold or block a booking"), so the theme control is a switch
(`role="switch"`, "Dark theme") and the palette opens from the keyboard or from a click on its hint.

## Responsive behaviour

| Width | Layout |
|---|---|
| 1100 px and up | Command bar with the context line; rail on the left |
| 960–1099 px | The context line is hidden |
| Below 960 px | The rail becomes a scrolling strip under the bar; the signed-in line takes its own row. A drawer would hide the links, and EN-14's visual journey clicks New request at 360 px. |
| Below 768 px | Two-column detail screens (review, request) stack, ending the sideways scroll EN-14's evidence recorded at 360 px |
| Below 640 px | Tables become stacked cards, each value under its column's name |

## Accessibility

- `frontend/tests/theme.test.ts` checks every text pair in both themes against 4.5:1, and field
  outlines and the focus ring against 3:1 (WCAG 2.2 AA).
- `frontend/scripts/capture-ui.ts` runs axe (WCAG 2.0, 2.1 and 2.2, A and AA) on every screenshot
  below: no violations in either theme at any width.
- Focus is always visible (a 2 px accent ring). Links that stand alone get a 24 px target (2.5.8).
- EN-14's browser tests run axe on every screen they visit, in the default (dark) theme.

## The legacy colour bridge

Screens written before the redesign set a few light-theme colours inline, for example
`style={{ color: "#626F86" }}`. Editing every screen would collide with every open pull request, so
`src/theme/legacy.css` maps each of those colours to the token that means the same thing (a browser
writes an inline colour into the `style` attribute as `rgb()`, and an inline style loses to
`!important`). `theme.test.ts` fails if a screen sets an inline colour the bridge doesn't map.

When you next edit a screen, replace its inline hex with the token, for example
`color: "var(--cs-text-subtle)"`.

## The attendee surface

The attendee screens (R1 to R4) are a separate public app (implementation.md §7.2, ADR-0014). They
keep their own single-column shell. `FixedTheme` holds them in the light theme and the system font,
whatever theme the staff console was left in on that browser, and the bridge maps their colours.

## How to add a screen

1. Add the route to `ROUTES` in `src/App.tsx`, with `nav` if it belongs in the rail. Its group comes
   from the first word of its path; a new first word needs an entry in `SECTIONS`
   (`src/shell/navigation.ts`), or it lands under "other".
2. Build it from Atlaskit components. Title it with an `h2`; mark sections with `h3`.
3. Lists: `@atlaskit/dynamic-table` (or a plain `<table>` with a `<thead>`). The shell makes it dense,
   gives it a sticky header, sets its references and times in mono, and turns it into cards on a
   phone. Keep the header row: the cards' labels come from it.
4. Status: a lozenge with its appearance from `src/shared/status.ts`. Never a colour of its own.
5. Colours in inline styles: tokens only, `var(--cs-…)`. No hex.
6. Detail screens: content left, an `<aside>` right; below 768 px they stack.
7. Run `npm run test:unit -w @connectsphere/web` (the contrast and bridge checks), and look at it in
   both themes with the switch in the command bar.

## Screenshots

Taken by `frontend/scripts/capture-ui.ts` with the API answered from `frontend/scripts/ui-fixtures.ts`
(no backend, no account, nothing leaves the machine). A selection is committed here:

| Screen | Dark | Light |
|---|---|---|
| Review queue, 1440 px | [dark](ui-redesign/dark-review-queue-1440.png) | [light](ui-redesign/light-review-queue-1440.png) |
| Review of a request, 1440 px | [dark](ui-redesign/dark-review-detail-1440.png) | [light](ui-redesign/light-review-detail-1440.png) |
| Venue availability, 1440 px | [dark](ui-redesign/dark-venue-availability-1440.png) | |
| All events, 768 px | [dark](ui-redesign/dark-all-events-768.png) | [light](ui-redesign/light-all-events-768.png) |
| Review queue as cards, 360 px | [dark](ui-redesign/dark-review-queue-360.png) | [light](ui-redesign/light-review-queue-360.png) |
| Sign-in, 1440 and 360 px | [1440](ui-redesign/dark-sign-in-1440.png), [360](ui-redesign/dark-sign-in-360.png) | |
| Ctrl+K palette, 1440 px | [dark](ui-redesign/dark-command-palette-1440.png) | |

To make the full set (11 screens, both themes, 360, 768 and 1440 px):

```bash
npm run build -w @connectsphere/web
cd frontend && npx vite preview --port 4317 --strictPort --host 127.0.0.1 &
cd .. && npx tsx frontend/scripts/capture-ui.ts --out documentation/design/ui-redesign/all
```

## Bundle

`vite build`, gzipped, on main at `937768c` (before) and on this branch merged with it (after):

| | Before | After |
|---|---|---|
| App JavaScript (`index-*.js`) | 235.05 kB | 248.73 kB |
| Atlaskit token theme, loaded on demand (one colour theme and spacing) | — | 3.00 kB (dark) or 2.93 kB (light) |
| **JavaScript a signed-in screen loads** | **235.05 kB** | **251.73 kB** |
| Dynamic table's lazy body for rankable rows (`body-*.js`; no screen ranks rows, so it isn't loaded) | 36.70 kB | 36.71 kB |
| CSS | 2.29 kB | 8.39 kB |
| Fonts (woff2, Latin only) | — | 95 kB: Plex Sans variable 65 kB, Plex Mono 400 and 500, 15 kB each |

The budget is 300 kB of JavaScript for the app page: 251.73 kB, or 288.44 kB even if the lazy chunk were loaded. Checked by listing what the review queue requests in Chromium: the app bundle, the dark theme, spacing, the CSS and the three fonts.

## Known limits

- EN-14's visual baselines show the old look; they are remade on Linux CI by running the CI
  workflow by hand with "update snapshots", then committed (documentation/evidence/EN-14).
- The palette has no button to open it (see the shell, above); on a phone the rail strip does that job.
- The bridge is a stopgap: it goes once no screen sets a hex colour inline.
