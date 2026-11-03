# U1-T3 — The review shows the factors the Safety Officer weighs

## Specification

| Item | Content |
|---|---|
| Test Case ID | U1-T3 |
| Test Scenario | The review shows the factors the Safety Officer weighs |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (`npm run migrate:all`, with the CI seed). Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-U1 from `tests/U1/README.md`: event E1 in Safety Review (owner ORG, assigned to C1, expected attendance 120, accessibility needs recorded), confirmed booking B1 (venue `U1 Hall`, layout Theatre, capacity 150) and reservation R1 (`U1 Chairs` × 5, placement note recorded). |
| Test Steps | 1. As SO, send `GET /api/v1/events/<E1>/safety-review`. |
| Test Data | Actor SO. |
| Expected Result | HTTP 200 with the expected attendance (120), the accessibility needs, each booked venue with its name, period, booked layout, that layout's capacity (150), the venue's maximum capacity and its layouts, and each reserved equipment line with its type, quantity and placement note. No venue field is added (CQ-10). Outstanding arrangement flags, if any, are listed, and the response shows no decision yet. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the PR reviewer** against U1's acceptance criteria before the
> code is merged (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | The review returned attendance 120, the accessibility needs, the booked venue with its period, layout Theatre, capacity 150, maximum capacity 200 and both layouts, the equipment line with type, quantity 5, reservation id, reserved 5 and the placement note, no flags and no decision. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 042f2d5 · Evidence: backend/services/planning-core/tests/change/api/u1Cards.test.ts › U1-T3 the review shows the factors the Safety Officer weighs, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41475757839 · Defect: — (that run's integration job fails only on tests/race/invariants.test.ts L3-T17, a fixed-date test outside U1; every U1 card passed) |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-02 |
