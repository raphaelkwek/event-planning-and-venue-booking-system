# Changelog

> **Convention — read before editing this file:** entries are newest-first. When adding a new entry, insert it directly below this header, above every existing entry. Never append to the bottom. This header itself never moves and is never treated as an entry.

---

# Jira changes

**Timestamp:** 2026-09-15T16:30+08:00 (SGT)
**Author:** Chai, via Claude
**Reason:** Live-Jira cross-reference of the Rovo agent's first pass against `Jira__2_.md`'s 23-item instruction set found a missed edit and two missing links; naming-convention drift on Sprint 1's test issues was found separately. `Jira__2_.md` sections 0–0e cover both. All have now been applied in Jira.

## `Jira__2_.md` sections 0–0e — applied

1. **Section 0 (rectification)** — R1's REPLACE LINE, missed in the first pass, applied. F5's missing "relates to" links to M1 and Q1 added (only the F1 link had been created).
2. **Section 0c** — SPM-61 (T2, a Story issue) renamed to fix its dash: `T2 - ...` → `T2 — ...`.
3. **Section 0d** — SPM-86–107, the 22 Test issues for Sprint 1's stories (A1–E2), renamed from their legacy ticket-number prefix (`SPM-11:`, `SPM-12:`, …) to `<code>-T<n> — <title>` (e.g. `A1-T1 — Valid login (Organiser)`), so a test case's summary can never be mistaken for its story's.
4. **Section 0e** — SPM-82–85, four shared service-test subtasks that each span more than one story, tagged to their parent feature letter only, no story number: `R-T1`, `F-T1`, `E-T1`, `E-T2`.

## Sprint 1 point total — unchanged at 35

All Sprint 1 test issues (SPM-86–107, plus the shared SPM-82–85) have been moved into the Sprint 1 to-do list. The Sprint 1 story-point total is **not** increased for this: each story's original point estimate is taken to have already factored in the effort of testing that story, so the tests are additional *issues* tracked in the sprint, not additional *scope* against the estimate.

## Net effect

`Jira__2_.md` and the live Jira board are now consistent with each other and with `Final_User_Stories__2_.md`'s naming convention, including the test-issue layer that convention didn't originally cover. Sprint 1's committed points remain 35 across its 15 stories; the 26 test issues now sitting in the Sprint 1 to-do list are covered by that existing estimate.

---

# Changelog — Stale Cross-Reference Fixes (Revision 3 follow-up)

**Timestamp:** 2026-09-15T05:19:53Z
**Author:** Chai, via Claude
**Reason:** The F1/F5 and F3/F4 story splits in Revision 3 left several cross-references pointing at the wrong story. These are corrections only — no acceptance criteria were changed in substance, only which story they cite.

---

## `Final_User_Stories__2_.md`

1. **B2** — `(F1)` → `(F5)` in the equipment-required-flag bullet. The confirmation-readiness rule it cites lives in F5, not F1.
2. **L3** — `(F1)` → `(F5)` in the "does not by itself allow the event to become Confirmed" bullet. Same reason as #1.
3. **L3** — `(F3)` → "as part of the release run in F4" in the "released automatically when the event is cancelled" bullet. F3 only records the cancellation decision; F4 owns the actual release.
4. **S3** — `(F1 readiness rule)` → `(F5 readiness rule)` in the Confirmed-status refusal bullet. Same reason as #1.
5. **Q2** — `(F3)` → "as part of the release run in F4" in the reservation-release bullet. Same reason as #3. Q2 was not in Revision 3's official revised-stories list, so this reference was never revisited when F3 split.
6. **R1** — Reworded "when a registration capacity is set — the number of places remaining" to "the number of places remaining, derived from the capacity of the booked venue for the booked layout (R2)." R1's sibling story R2 already states capacity is always derived from the booked venue, never a separate optional field; R1 was not updated to match when R2 changed.

## `Jira__2_.md`

1. **Header** — Scope updated from "21 changes — 5 new work items, 1 deletion, 15 edits" to "23 changes — 5 new work items, 1 deletion, 17 edits" to account for the two added items below. Out-of-scope note reworded: A3/B2/E1/E2 are now marked as already completed rather than "handled separately," since that work is done.
2. **Item 11 (L3)** — Same fix as source-doc change #2 above, applied to the CREATE block's description.
3. **Item 21 (S3)** — Same fix as source-doc change #4 above, applied to the REPLACE DESCRIPTION block.
4. **New item 15 (Q2)** — Added, carrying source-doc change #5 above as a REPLACE LINE instruction, with a "Why" note explaining the knock-on effect.
5. **New item 16 (R1)** — Added, carrying source-doc change #6 above as a REPLACE LINE instruction, with a "Why" note explaining the knock-on effect.
6. **Renumbering** — Items formerly numbered 16–21 (R4, R6, R7, S3, T1, T2) shifted to 18–23 to make room for the two insertions.

---

## Net effect

Every stale F1/F3 cross-reference introduced by the Revision 3 story splits is now resolved across both files. Sprint 1 stories (A3, B2, E1, E2) were confirmed already correct and are untouched by this pass.
