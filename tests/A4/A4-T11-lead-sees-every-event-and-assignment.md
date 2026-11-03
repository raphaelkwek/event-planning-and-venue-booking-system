# A4-T11 — The Lead sees every event and every assignment (E5)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T11 |
| Test Scenario | The Lead sees every event and every assignment (E5) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As LEAD, send `GET /api/v1/events`.<br>2. As LEAD, send `GET /api/v1/events/<E4>` and `GET /api/v1/events/<E3>`.<br>3. As LEAD, send `GET /api/v1/assignments`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T11 '` and read the named `A4-T11 ` result. |
| Test Data | Actor LEAD. Events E1 to E6. |
| Expected Result | Step 1 lists E1, E2, E3, E4 and E6, and not E5 (ORG's draft is visible to ORG alone, C1). Step 2 answers 200 with each event's full content. Step 3 lists E1, E2 and E6 with C1, E4 with C2, and E3 as Unassigned. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Lead's list held E1, E2, E3, E4 and E6 and not E5; E4 and E3 opened with 200. The overview showed E1, E2, E6 with C1, E4 with C2 and E3 unassigned. |
| Status | Pass |
| Remarks | Commit: a1ceeae, automated (`tests/event/api/a4Cards.test.ts`), on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
