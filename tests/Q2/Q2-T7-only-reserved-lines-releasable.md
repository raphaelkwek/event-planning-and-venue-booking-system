# Q2-T7 — Only a Reserved line can be released

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T7 |
| Test Scenario | Every status other than Reserved refuses release, names the status and changes nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q2 from `tests/Q2/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), the actors TS, C1, ORG, VS and ATT, and line L1 (CHAIRS × 4 for E1, Confirmed, then reserved by TS through `POST /api/v1/equipment/request-lines/<L1>/reservation`, leaving 6 CHAIRS).<br>3. Six CHAIRS lines for E1, one in each status: Submitted, Under Review, Confirmed, Unavailable, Substituted (with a CHAIRS × 1 substitute) and Removed. |
| Test Steps | 1. For each line, as TS, send `POST /api/v1/equipment/request-lines/<id>/release` with the body in Test Data.<br>2. Read each line and CHAIRS availability for E1's window after each request.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-T7 '` (or the whole suite) and read the named `Q2-T7 ` result. |
| Test Data | `{"reason":"x"}` |
| Expected Result | Each request returns HTTP 409 `LINE_NOT_RELEASABLE`. The message names the status label, `details.status` holds the status code, and no line, reservation or availability changes. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The automated test performed this card's steps against the real Express app and a migrated Postgres (authentication stubbed) and its assertions passed; they check the expected result above. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cc43643b6269cae9c30c54d2cdf6081afb8bf003 · Evidence: backend/services/planning-core/tests/equipment/api/q2Cards.test.ts › Q2-T7, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38932644480 · Defect: — |
| Executed By | Raphael, via automated testing (CI) |
| Date of Execution | 2026-10-17 |
