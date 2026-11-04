# Submission builder covers all seven Week 12 parts

**Timestamp:** 2026-11-04T09:10+08:00 (SGT)
**Author:** Joash
**Scope:** `documentation/scripts/` (builder, backlog export), `documentation/backlog/`, `documentation/week12-submission/`, `package.json`.

## Changed

`npm run submission:build` now assembles every numbered folder the Week 4 instructions require,
writes `ConnectSphere.zip` and a `MANIFEST.md` that ticks each part as present, placeholder or
missing. Before this it built only folders 3 and 4, and its sprint calendar stopped at Sprint 2.

- Folder 1 comes from `documentation/backlog/jira-export.json` and `.xlsx`, made by
  `npm run backlog:export` from read-only Jira search results for project SPM (159 issues).
- Folder 4 now covers Sprints 1 to 4 (the sprint calendar lists all four).
- Folder 6 is `git archive` of the chosen ref, without example zips or `node_modules`.
- Recordings and instructor access are human actions, so they ship as named placeholders
  (`documentation/week12-submission/recordings-required.md`, `git-access.md`).
- `exceljs` was imported but not declared in `package.json`, so the builder failed on a clean
  clone. It and `jszip` are now dev dependencies, and the builder's tests run in `test:scripts`.
