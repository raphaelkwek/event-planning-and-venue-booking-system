# A4-T9 — The Lead, who sees every event, cannot perform coordinator actions on any of them (W9-35, A2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T9 |
| Test Scenario | The Lead, who sees every event, cannot perform coordinator actions on any of them (W9-35, A2) |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As LEAD, send `POST /api/v1/events/<E1>/approve`.<br>2. As LEAD, send `PATCH /api/v1/events/<E2>` with `If-Match` and `{"purpose":"Share faculty research across schools"}`.<br>3. As LEAD, send `POST /api/v1/booking-requests` for E2 at V1 with L1's standard body.<br>4. As LEAD, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`.<br>5. Read E1, E2, CR1 and E2's booking requests.<br>6. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T9 '` and read the named `A4-T9 ` result. |
| Test Data | Actor LEAD. E1, E2, CR1, V1. |
| Expected Result | Each request answers HTTP 403 `ROLE_NOT_AUTHORISED`, "Your role is not authorised to use this function." E1 is still Under Review, E2's purpose unchanged, CR1 still Pending, and E2 still has only BR1. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | All four answered 403 ROLE_NOT_AUTHORISED "Your role is not authorised to use this function."; nothing changed. |
| Status | Pass |
| Remarks | Commit: a1ceeae, automated (`tests/event/api/a4Cards.test.ts`), on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
