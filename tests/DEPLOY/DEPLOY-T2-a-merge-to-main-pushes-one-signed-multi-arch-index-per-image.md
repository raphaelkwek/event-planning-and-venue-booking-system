# DEPLOY-T2 — A merge to main pushes each image once to GHCR as one multi-arch index, signs it keylessly and attests its SBOM

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T2 |
| Test Scenario | A merge to main pushes each image once to GHCR as one multi-arch index, signs it keylessly and attests its SBOM |
| Pre-conditions | 1. A pull request has been merged to main.<br>2. The Release workflow ran on that push. |
| Test Steps | 1. Open the Release run for the merge commit.<br>2. Check `Build (<image>, <arch>)` pushed one digest per image and architecture, and `Publish (<image>)` joined them into `ghcr.io/joass1/connectsphere-<image>:<sha>`.<br>3. Check the publish step signed the index digest, attested its CycloneDX SBOM and verified both for the identity `.github/workflows/release.yml@refs/heads/main`.<br>4. Run `cosign verify` from documentation/supply-chain.md against one digest yourself. |
| Test Data | The merge commit's images in GHCR. |
| Expected Result | One index per image, built once, signed and attested; a wrong identity is refused. |
| Acceptance criterion | Every merge to main builds the images once, signs them (cosign keyless) and attests an SBOM. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

> **Revised 2026-11-04.** The repository moved from `raphaelkwek/` to `joass1/` on 4 Nov 2026, so the
> images are `ghcr.io/joass1/connectsphere-<image>:<sha>` and the signing identity is
> `https://github.com/joass1/event-planning-and-venue-booking-system/.github/workflows/release.yml@refs/heads/main`.
> The steps and the expected result are otherwise unchanged.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: the Release workflow runs only on a push to main. Proven on this pull request: the same sign-and-attest action signs, attests and verifies in the Supply chain workflow (EN-21-T5), and actionlint passes release.yml. |
| Status | Not Executed |
| Remarks | Evidence: .github/workflows/release.yml › jobs 'Build', 'Publish' (main only) · Defect: — |
| Executed By | — |
| Date of Execution | — |
