# Sprint 4 cards that were still Not Executed: browser journeys for R5 to R7, S3-T13, and the S3, G2 and F3 API cards recorded

**Timestamp:** 2026-11-04T11:43+08:00 (SGT)
**Author:** Joash
**Scope:** `tests/e2e/` (a new spec, two support modules, Attendee Two for the browser stack, S3-T13 beside G2-T8), five API card tests in `backend/services/planning-core/tests/change/api/` made to assert what their cards say, and the execution records in `tests/R5/`, `tests/R6/`, `tests/R7/`, `tests/S3/`, `tests/G2/`, `tests/F3/`, `tests/F4/`, `tests/Q1/`, `tests/S1/` and `tests/S2/`. No app code and no migration.

**Reason:** R5, R6, R7, S3, F3 and G2 are Done, but most of their cards were never recorded: the R cards waited for a walk-through in Chrome, and the S3, G2 and F3 API cards waited for "CI on the PR" and were never filled in. The definition of done needs every card run.

## What changed

1. **`tests/e2e/r-management.spec.ts`**: one browser journey per R5, R6 and R7 card that the stack can run, titled with the card id, tagged with the story and the card, and axe-checked. The FX-R-MANAGED, FX-R-WITHDRAW-ONE, FX-R-WAITLISTED and FX-R-NO-VENUE statements of `tests/R5/README.md` are in `support/seed-management.ts`. Attendee Two, whom R6-T6, R6-T7, R6-T8 and R7-T12 need, is added to the job's throwaway database only; the seed and the shared project are untouched.
2. **Shared attendee screens:** the helpers move from `r-registration.spec.ts` to `support/registration-screens.ts`. Removing the R fixtures clears the waitlist first, since an entry that ended in a registration names it.
3. **S3-T13** joins G2-T8 in `q-equipment-and-changes.spec.ts`, as an expected failure (see Defects).
4. **API card tests:** S3-T2, S3-T6, S3-T14, G2-T4 and F3-T6 each left a clause of their card unchecked; they now assert it.
5. **Records,** from the green CI run named in each card: 22 browser cards Pass (R5-T1 to T6; R6-T1, T2, T5, T7, T9; R7-T2, T4 to T13), 24 API cards Pass (S3-T1 to T7, T9 to T12, T14; G2-T2 to T6; F3-T1, T3 to T8), 1 Fail (S3-T13). Eight browser cards stay Not Executed with what is proven (R6-T6, R6-T8, R7-T1, Q1-T14, S1-T13, S2-T12, F3-T9, F4-T8), and G2-T1 likewise.

## Defects

- **S3-T13 (Fail):** an Event Coordinator not assigned to the event cannot open it, so does not see the Outstanding flags that S3's AC8 and the card say Event Coordinators see. S3-T8 records the same 404 at API level as intended, so AC8 and G1's assignment scoping need one reading. Not fixed here.

## Not done

- Steps that read Notifications: the notices are built from Kafka messages and the browser stack runs without Kafka (EN-14), so those cards stay Not Executed. R6-T10 and R6-T11 are not automated at all: they start from Kafka messages (F3's cancellation, M1's booking) reaching the registration service.
- G2-T1's step 2 is a reading of two source files, which no test performs; read by hand, the type reaches `frontend/src/shared/changeRequests.ts` through `frontend/src/api/changeRequests.ts`'s alias of the contracts' type, not straight from the contracts as the card says.
- F4-T7 stays Blocked, and A3-T8 is left as it is (its defect is being fixed separately).
