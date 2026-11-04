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
| Actual Result | Release run 41777894521 for d1e6c08: the twelve Build jobs pushed by digest and the six Publish jobs created ghcr.io/joass1/connectsphere-<image>:d1e6c088e10be1332b8e0808c499bf849b918c40 for planning-core, registration, notification, migrate, cerbos and space. Resolved anonymously from GHCR on 4 Nov 06:45 UTC (`crane digest`), each of the six tags gave a multi-arch index for linux/amd64 and linux/arm64; there is no -web package, as the web app is on Vercel. This pull request (#116) has no Release run (release.yml runs only on a push to main), and its Deploy run pushed nothing (deploy.yml builds the images with `load: true` to test them). |
| Status | Pass |
| Remarks | Read-only check · Commit: d1e6c08 · Evidence: Release run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41777894521 (jobs Build and Publish); crane digest against GHCR, 4 Nov 2026 06:45 UTC · Defect: — |
| Executed By | Joash, via read-only checks (GitHub Actions logs, cosign) |
| Date of Execution | 2026-11-04 |
