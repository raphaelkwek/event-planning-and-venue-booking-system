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
