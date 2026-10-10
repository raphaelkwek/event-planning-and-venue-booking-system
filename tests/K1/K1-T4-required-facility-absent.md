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
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
