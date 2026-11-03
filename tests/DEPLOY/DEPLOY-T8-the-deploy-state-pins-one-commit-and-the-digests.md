# DEPLOY-T8 — The deploy state pins one manifests commit and the image digests, and production receives exactly staging's

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T8 |
| Test Scenario | The deploy state pins one manifests commit and the image digests, and production receives exactly staging's |
| Pre-conditions | 1. The unit tests run (`npm run test:unit`, which runs `npm run test:scripts`). |
| Test Steps | 1. Render the staging and production state from one release (a commit and five digests).<br>2. Compare them.<br>3. Render with a tag instead of a digest, a short commit, or an API host with a scheme. |
| Test Data | A made-up release. |
| Expected Result | Both states name the same commit and the same five digests; they differ only in the overlay path, the API host and the web origin. Step 3 is refused. |
| Acceptance criterion | Production deploys the SAME image digests as staging, after approval. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Not Executed |
| Remarks | — |
| Executed By | — |
| Date of Execution | — |
