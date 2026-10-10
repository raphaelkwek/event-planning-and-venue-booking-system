# K1-T5 — A required accessibility feature the venue does not offer is Not suitable

## Specification

| Item | Content |
|---|---|
| Test Case ID | K1-T5 |
| Test Scenario | A required accessibility feature the venue does not offer is Not suitable |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUITABILITY loaded (see README).<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open **Venues** and select `K1 Test Hall`.<br>2. In the "Suitability" section choose the event from the list.<br>3. Click **Check suitability**. |
| Test Data | Event `K1-E-ACCESS`: accessibility needs "Hearing loop" and "Braille signage" (one per line); `K1 Test Hall` offers Step-free entrance and Hearing loop |
| Expected Result | **Not suitable**. One reason: required accessibility feature absent, naming Braille signage, with the venue's features (Step-free entrance, Hearing loop). Hearing loop is not named as missing. |
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
