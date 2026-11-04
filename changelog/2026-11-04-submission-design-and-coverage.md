# The Week 12 zip carries the ER, domain and state diagrams, and the coverage percentages CI printed

**Timestamp:** 2026-11-04T13:10+08:00 (SGT)
**Author:** Joash
**Reason:** The re-run compliance audit (4 Nov) found that folder 2 of the zip held only the C4
model and the ADRs, leaving out the ER diagram per schema, the domain model and the state diagrams
that #102 added under `documentation/architecture/`, and that folder 3's coverage statement gave
counts but no coverage numbers. The rubric asks for the coverage or a stated reason.
**Scope:** `documentation/scripts/submission-package.ts` and its test. No service code.

## Changed

- **Folder 2 (System Design)** copies `documentation/c4`, `documentation/architecture` (as "Data
  Model, Domain and State Diagrams") and `documentation/adr`, and adds `documentation/architecture.md`
  as "Architecture Index.md". The list is `DESIGN_PARTS`, which a test pins.
- **Folder 3 (Test Cases):** when the deliverables folder holds a `coverage.json` (the
  Statements and Branches lines of one green CI run on main, with the run's URL and commit), the
  coverage statement adds a table of each workspace's coverage and copies the file beside it.
  Without one, it gives counts only, as before. No percentage is written that a CI run didn't print.
