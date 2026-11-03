# The web app as an operations console: dark and light themes, a new shell, dense data

**Timestamp:** 2026-11-03T22:06+08:00 (SGT)
**Author:** Joash
**Scope:** the web app (`frontend/`): theme, shell, fonts and tests. No screen file, route, API call,
form field or user-visible text changed. Design notes: `documentation/design/ui-redesign.md`.

## Changed

- **Themes.** A dark operations-console theme is the default, with a designed light theme; the
  switch in the command bar remembers the choice in this browser. `src/theme/tokens.css` holds both
  palettes: graphite surfaces, stark text, hairlines, one cyan accent (focus, place, links), "ink"
  primary actions, and six status families used only for status.
- **Atlaskit is themed, not replaced.** `setGlobalTheme` loads Atlaskit's own light or dark tokens and
  `src/theme/atlaskit.css` points the ones that carry the look at ours (implementation.md §7.1, with
  a note added there).
- **Shell.** A command bar (mark, a context line such as `VENUES / AVAILABILITY`, a Ctrl+K hint, the
  environment badge, the unread count, the theme switch, "email · Role" and Sign out), a rail of the
  role's screens grouped by section, and a Ctrl+K palette offering exactly the rail's links (A2).
  The sign-in screen sits in a brand frame, still with no banner or navigation (A1).
- **Type.** IBM Plex Sans (variable, titles slightly condensed) and IBM Plex Mono for references,
  counts, dates and times, self-hosted from `@fontsource`, Latin files only.
- **Dense data.** Tables get tight rows, hairlines, capital headers that stick under the bar, and a
  row highlight on hover and focus; the shell sets ids and times in mono without editing screens.
- **Small screens.** Below 960 px the rail becomes a scrolling strip (every link stays visible, as
  EN-14's visual journey needs at 360 px); below 768 px two-column detail screens stack, which ends
  the sideways scroll EN-14's evidence recorded; below 640 px tables become labelled cards.
- **Motion.** A screen fades and lifts in when it changes (not when only its id does), started before
  paint and stopped under `prefers-reduced-motion`. Dialogs now open without Atlaskit's fade: EN-14's
  S2-T12 ran axe on the reject-change dialog mid-fade and failed it on contrast.
- **Legacy colour bridge.** `src/theme/legacy.css` maps the light-theme hex colours screens still set
  inline to tokens, so the dark theme keeps its contrast without touching the screens. The calendar
  bars in `shared/status.ts` read the status tokens.
- **Attendee surface.** R1 to R4's screens keep their own shell (implementation.md §7.2); `FixedTheme`
  holds them light and in the system font whatever the console's theme.

## Tests and evidence

- `frontend/tests/theme.test.ts`: every text pair in both themes against 4.5:1, field outlines and the
  focus ring against 3:1, both themes complete, and every inline colour mapped by the bridge.
- `frontend/tests/shell.test.tsx`: the rail's groups, the context line, the theme switch and its
  memory, Ctrl+K and the palette, and the table markup. All 515 frontend tests pass, unchanged ones
  included.
- `frontend/scripts/capture-ui.ts` screenshots 11 screens in both themes at 360, 768 and 1440 px with
  the API answered from fixtures, and runs axe (WCAG 2.0 to 2.2, A and AA): no violations. A selection
  is in `documentation/design/ui-redesign/`.
- Bundle: the JavaScript a signed-in screen loads goes from 235.05 kB to 251.73 kB gzipped (budget
  300 kB); fonts add 95 kB of woff2.
- EN-14's visual baselines are remade on Linux CI (the CI workflow run by hand with "update
  snapshots") and committed with this change.
