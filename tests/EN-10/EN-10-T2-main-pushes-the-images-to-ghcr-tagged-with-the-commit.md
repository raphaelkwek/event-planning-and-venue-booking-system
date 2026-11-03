# EN-10-T2 — A push to main publishes each image to GHCR, tagged with the commit sha; a pull request publishes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T2 |
| Test Scenario | A push to main publishes each image to GHCR, tagged with the commit sha; a pull request publishes nothing |
| Pre-conditions | 1. This pull request merged into main.<br>2. The repository allows GitHub Actions to write packages. |
| Test Steps | 1. Open the Deploy run for the merge commit on main.<br>2. In each `Image (...)` job, check `Log in to GHCR` and `Push to GHCR, tagged with the commit sha` ran and passed.<br>3. Open `ghcr.io/raphaelkwek/connectsphere-planning-core:<merge commit sha>` (and the other four) in the repository's Packages.<br>4. On a pull request run, check both steps are skipped. |
| Test Data | The merge commit's sha. |
| Expected Result | Five packages exist, `connectsphere-planning-core`, `-registration`, `-notification`, `-web` and `-migrate`, each with a tag equal to the merge commit's sha. The pull request run pushed nothing. |
| Acceptance criterion | Images are pushed to GHCR from main only, with permissions: packages: write, tagged with the commit sha. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run. The push step is conditioned on a push to main, so it cannot run on a pull request. Whether this repository lets the workflow token write packages is unknown until the first merge. |
| Status | Not Executed |
| Remarks | Commit: · Evidence: .github/workflows/deploy.yml › 'Push to GHCR, tagged with the commit sha' (runs only on push to main). Since ADR-0016 the push is in .github/workflows/release.yml › jobs 'Build' and 'Publish' (one multi-arch index per image, tagged with the commit sha); see DEPLOY-T2 · Defect: |
| Executed By |  |
| Date of Execution |  |
