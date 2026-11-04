# K1-T13 — CR-03: for an event with several venues, each venue is assessed against its own booking request

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T13 |
| Test Scenario | CR-03: for an event with several venues, each venue is assessed against its own booking request |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied; authentication stubbed, as the planning-core API tests do (the signed-in user is whichever actor a step names).<br>2. An Approved event E, assigned to coordinator C, asking for 150 people in Theatre, a projector and step-free access.<br>3. Two venues looked after by Venue Staff: `L4 Main Hall` (Theatre 300, Classroom 120; Projector; Step-free access) and `L4 Breakout Room` (Theatre 50, Classroom 60; Whiteboard; Hearing loop). |
| Test Steps | 1. As C, read each venue's suitability for E (K1's check on the event's own values).<br>2. As C, request `L4 Main Hall` for E with layout Classroom, 130 people, facilities Projector and Livestream, accessibility Hearing loop; when refused for a justification, send the same request with one.<br>3. As C, request `L4 Breakout Room` for E with layout Classroom, 40 people, facility Whiteboard, accessibility Hearing loop.<br>4. Read each request's result in Venue Staff's queue and in C's view of E's booking requests.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/venue/api/severalVenues.test.ts -t 'K1-T13 '` and read the named result. |
| Test Data | As in the steps. Justification: `The livestream crew bring their own kit and a portable loop.` |
| Expected Result | Each venue shows its own result, assessed against its own booking request's values and not against the event's. Step 1 finds the hall Suitable and the breakout room Not suitable on the event's values. Step 2 is refused with `JUSTIFICATION_REQUIRED` and then stored Not suitable, with exactly the request's own reasons: attendance 130 against Classroom 120, Livestream absent, Hearing loop absent. Step 3 is stored Suitable with no reasons. Step 4 shows each venue with its own request's result, in the queue and in C's view. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

> **Written out 2026-11-04.** The case was a placeholder until L1 and L4 existed ("To be written when L1 and L4
> land"). Its steps and data are now concrete, with the venues and values chosen so that the event's values and each
> request's own values give opposite results; the expected result is the one the placeholder stated, made specific.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Blocked until L1 and L4 exist (Sprint 3) |
| Executed By | |
| Date of Execution | |
