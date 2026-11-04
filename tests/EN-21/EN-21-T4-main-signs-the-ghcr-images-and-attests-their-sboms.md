# EN-21-T4 — A push to main signs each GHCR image keylessly, attests its SBOM, and verifies both

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T4 |
| Test Scenario | A push to main signs each GHCR image keylessly, attests its SBOM, and verifies both |
| Pre-conditions | 1. This pull request merged into main.<br>2. The repository allows GitHub Actions to write packages, and the workflow may request an OIDC token (`id-token: write`). |
| Test Steps | 1. Open the Release run for the merge commit on main.<br>2. In each `Publish (<image>)` job, check the `sign-and-attest` action signed, attested and verified the index digest.<br>3. From a terminal run the commands in documentation/supply-chain.md: `cosign verify`, `cosign verify-attestation --type cyclonedx` and `cosign tree` against `ghcr.io/joass1/connectsphere-planning-core@<digest>` (and the other five).<br>4. On a pull request, check nothing is signed in GHCR. |
| Test Data | The merge commit's image digests. |
| Expected Result | Each of the six images has a signature and a CycloneDX SBOM attestation in GHCR, signed with the certificate identity of the Release workflow on refs/heads/main and the GitHub OIDC issuer. `cosign verify` and `cosign verify-attestation` succeed from a terminal. The pull request run signed nothing in GHCR. |
| Acceptance criterion | cosign: keyless signing (GitHub OIDC, id-token: write) of the images pushed to GHCR on main, plus SBOM attestations (cosign attest), and a cosign verify step after signing. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

> **Revised 2026-11-04, for ADR-0016.** The signing moved with the push: the Release workflow's
> `Publish (<image>)` job calls the same `sign-and-attest` action on each image's index digest, with the
> identity `release.yml@refs/heads/main`, and the Deploy workflow signs nothing. There are six images (no
> `-web`, which Vercel builds; `-cerbos` and `-space` added). The repository moved to `joass1/` on 4 Nov 2026.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Release run 41777894521 for d1e6c08: in each `Publish (<image>)` job (planning-core, registration, notification, migrate, cerbos and space) the sign-and-attest action signed the index digest (`Pushing signature to: ghcr.io/joass1/connectsphere-<image>`), attested its CycloneDX SBOM, and verified both for `https://github.com/joass1/event-planning-and-venue-booking-system/.github/workflows/release.yml@refs/heads/main` and the GitHub OIDC issuer, and a wrong identity was refused. From a laptop (cosign 3.1.4, no GitHub login, 4 Nov 06:45 UTC), for all six images, `cosign verify` and `cosign verify-attestation --type cyclonedx` with that identity and issuer succeeded, and `cosign tree` listed the signature and SBOM referrers (planning-core sha256:fc6360104255…, SBOM of 3,689 components). This pull request (#116) has no Release run, so it signed nothing in GHCR. |
| Status | Pass |
| Remarks | Read-only check · Commit: d1e6c08 · Evidence: Release run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41777894521 (jobs Publish); cosign verify, verify-attestation and tree from a laptop against GHCR, 4 Nov 2026 06:45 UTC · Defect: — |
| Executed By | Joash, via read-only checks (GitHub Actions logs, cosign) |
| Date of Execution | 2026-11-04 |
