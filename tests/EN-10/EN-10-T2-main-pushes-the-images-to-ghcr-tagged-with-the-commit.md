# EN-10-T2 — A push to main publishes each image to GHCR, tagged with the commit sha; a pull request publishes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-10-T2 |
| Test Scenario | A push to main publishes each image to GHCR, tagged with the commit sha; a pull request publishes nothing |
| Pre-conditions | 1. This pull request merged into main.<br>2. The repository allows GitHub Actions to write packages. |
| Test Steps | 1. Open the Release run for the merge commit on main.<br>2. Check each `Build (<image>, <arch>)` job pushed its image by digest and each `Publish (<image>)` job created the index tagged with the commit sha.<br>3. Resolve `ghcr.io/joass1/connectsphere-planning-core:<merge commit sha>` (and the other five) in GHCR.<br>4. On a pull request, check no Release run exists and the Deploy run pushes nothing. |
| Test Data | The merge commit's sha. |
| Expected Result | Six packages exist, `connectsphere-planning-core`, `-registration`, `-notification`, `-migrate`, `-cerbos` and `-space`, each with a tag equal to the merge commit's sha. The pull request pushed nothing. |
| Acceptance criterion | Images are pushed to GHCR from main only, with permissions: packages: write, tagged with the commit sha. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

> **Revised 2026-11-04, for ADR-0016 and its Azure amendment.** Since ADR-0016 the Deploy workflow
> pushes nothing: the Release workflow (`release.yml`, on every push to main) builds each image once per
> architecture (`Build (<image>, <arch>)`, pushed by digest) and joins them into one multi-arch index
> tagged with the commit sha (`Publish (<image>)`). The web app is built and deployed by Vercel, so there
> is no `-web` package; the images are planning-core, registration, notification, migrate, cerbos and
> space (the one-container image the Azure VM runs). The repository moved to `joass1/` on 4 Nov 2026.
> Steps 1 to 4 now read the Release run, and step 4 checks that a pull request runs no Release at all.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run. The push step is conditioned on a push to main, so it cannot run on a pull request. Whether this repository lets the workflow token write packages is unknown until the first merge. |
| Status | Not Executed |
| Remarks | Commit: · Evidence: .github/workflows/deploy.yml › 'Push to GHCR, tagged with the commit sha' (runs only on push to main). Since ADR-0016 the push is in .github/workflows/release.yml › jobs 'Build' and 'Publish' (one multi-arch index per image, tagged with the commit sha); see DEPLOY-T2 · Defect: |
| Executed By |  |
| Date of Execution |  |
