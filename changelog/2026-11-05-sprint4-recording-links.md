# The final sprint's recordings are linked, and Sprint 4 counts as reviewed

**Timestamp:** 2026-11-05T00:30+08:00 (SGT)
**Author:** Joash
**Reason:** The four Sprint 4 meetings (planning, review, retrospective and one daily stand-up) are
edited and uploaded as unlisted videos, so the last placeholder part of the Week 12 zip can be
filled. Sprint 4's Sprint Review was held on 4 Nov and the sprint was closed in Jira that evening.
**Scope:** `documentation/week12-submission/recordings-required.md`,
`documentation/scripts/build-submission.ts`, `documentation/scripts/submission-package.ts` and their
tests. No service code, no migration.

## Changed

- **`recordings-required.md`** lists the four unlisted links with the date, length and contents of
  each meeting, and says how the videos were edited. No `TODO` is left, so the submission builder
  reports the part as present.
- **The sprint calendar** marks Sprint 4 as reviewed, so Sprint 4's stories show as Done in the
  generated documents, like those of Sprints 1 to 3.
- **The submission builder** drops " - PLACEHOLDER" from a placeholder file's name in the zip once
  the file is finished (`placedName`), so folder 4 holds `6. Final Sprint Recordings.md`.
