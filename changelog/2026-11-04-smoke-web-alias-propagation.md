# The web smoke test waits for Vercel's alias to settle

**Timestamp:** 2026-11-04T10:55+08:00 (SGT)
**Author:** Joash
**Reason:** Release run 41755102911 (f1521b2, a docs-only merge) deployed staging, then failed
"the bundle does not call https://api.staging…" although the bundle did. Right after
`vercel deploy` aliases a new build, an edge can still answer with the previous one, so the entry
script the new shell names comes back as the SPA fallback page. The runs before and after it, with
the same web code, passed.
**Scope:** `deploy/release/smoke-web.sh` only.

## Fixed

- The bundle check reads the shell and its entry script (`src="/assets/….js"`, not the first
  `/assets/` link) together and tries again every 10 s for up to a minute before failing. A bundle
  built for another API host still fails, after the minute. Checked against staging and production.
