# EN-14 — Preview environments and browser tests

EN-14 is an enabler. Its cards check the browser-test harness itself: the ephemeral CI stack, the
fake Supabase Auth server, the story tags, axe and the visual snapshots. The journeys it runs are
recorded on the stories' own cards (`tests/<story>/`), not here.

| Criterion (plan §5) | Cards |
|---|---|
| A per-PR preview, or an ephemeral CI stack | EN-14-T1, T2, T3, T8 |
| Playwright E2E tagged with story test ids | EN-14-T4, T7 |
| axe accessibility checks | EN-14-T5 |
| Visual snapshots at 360, 768 and 1280 px | EN-14-T6 |

How to run it, and what it covers: `documentation/evidence/EN-14/README.md`.
