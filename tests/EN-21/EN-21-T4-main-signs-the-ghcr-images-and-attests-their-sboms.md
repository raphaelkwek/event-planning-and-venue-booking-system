# EN-21-T4 — A push to main signs each GHCR image keylessly, attests its SBOM, and verifies both

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T4 |
| Test Scenario | A push to main signs each GHCR image keylessly, attests its SBOM, and verifies both |
| Pre-conditions | 1. This pull request merged into main.<br>2. The repository allows GitHub Actions to write packages, and the workflow may request an OIDC token (`id-token: write`). |
| Test Steps | 1. Open the Deploy run for the merge commit on main.<br>2. In each `Image (...)` job, check the step `Sign, attest and verify (cosign, keyless)` ran and passed after `Push to GHCR, tagged with the commit sha`.<br>3. From a terminal run the commands in documentation/supply-chain.md: `cosign verify`, `cosign verify-attestation --type cyclonedx` and `cosign tree` against `ghcr.io/raphaelkwek/connectsphere-planning-core@<digest>` (and the other four).<br>4. On a pull request run, check that step is skipped. |
| Test Data | The merge commit's image digests. |
| Expected Result | Each of the five images has a signature and a CycloneDX SBOM attestation in GHCR, signed with the certificate identity of the Deploy workflow on refs/heads/main and the GitHub OIDC issuer. `cosign verify` and `cosign verify-attestation` succeed from a terminal. The pull request run signed nothing in GHCR. |
| Acceptance criterion | cosign: keyless signing (GitHub OIDC, id-token: write) of the images pushed to GHCR on main, plus SBOM attestations (cosign attest), and a cosign verify step after signing. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run. The signing step in deploy.yml runs only on a push to main, which has never run this pipeline. Proven on this pull request: the composite action that step calls signed, attested and verified an image in a local registry in all five jobs (EN-21-T5), and the Deploy run on this pull request passed with the step skipped. Not proven: that the repository lets the workflow token write packages and mint an OIDC token on main, and what GHCR does with the signature and attestation (referrers, package visibility). |
| Status | Not Executed |
| Remarks | Commit: 11d972ed593bf4abc6f26115f75ffd246e071c14 · Evidence: .github/workflows/deploy.yml › 'Sign, attest and verify (cosign, keyless)' (runs only on push to main; since ADR-0016 the same action runs in .github/workflows/release.yml › 'Publish (<image>)', with the identity release.yml@refs/heads/main, see DEPLOY-T2); the same action ran in https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41521790370 · Defect: — |
| Executed By |  |
| Date of Execution |  |
