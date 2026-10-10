# K1-T4 — A required facility the venue does not offer is Not suitable, naming what is missing and what the venue offers

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T4 |
| Test Scenario | A required facility the venue does not offer is Not suitable, naming what is missing and what the venue offers |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-FACILITY`: needs Projector and Simultaneous interpretation; `K1 Test Hall` offers Projector, Microphone and Livestream |
| Expected Result | **Not suitable**. One reason: required facility absent, naming Simultaneous interpretation, with the venue's facilities (Projector, Microphone, Livestream). Projector is not named as missing. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | For an event needing Projector and Simultaneous interpretation the route answered NOT_SUITABLE with exactly one reason, FACILITIES, missing Simultaneous interpretation, the venue offering Projector, Microphone and Livestream. |
| Status | Pass (automated, API level) |
| Remarks | Commit: a5038c9 · Evidence: backend/services/planning-core/tests/venue/api/suitability.test.ts › names the absent facility and what the venue offers, and nothing else (K1-T4), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38065630198 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-10 |
