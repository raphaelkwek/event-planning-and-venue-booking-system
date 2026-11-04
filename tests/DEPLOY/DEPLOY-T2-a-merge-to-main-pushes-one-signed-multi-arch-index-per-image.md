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
| Actual Result | Release run 41777894521, for d1e6c08 on main: each `Build (<image>, <arch>)` job (planning-core, registration, notification, migrate, cerbos and space, each for amd64 and arm64) pushed its image by digest (`push-by-digest=true`), and each `Publish (<image>)` job joined the two into one index tagged with the commit sha and checked its platforms were exactly linux/amd64,linux/arm64. Each Publish job then signed the index digest, attested its CycloneDX SBOM and verified both for `…/release.yml@refs/heads/main`, logging `ok: signature verifies`, `ok: CycloneDX attestation verifies`, `ok: the SBOM read back from the attestation has <n> components, as attested` and `ok: a wrong identity is refused`. Step 4, from a laptop with no GitHub login (cosign 3.1.4, 4 Nov 06:45 UTC): the tag of ghcr.io/joass1/connectsphere-planning-core resolved to sha256:fc6360104255…, `cosign verify` of that digest passed with the release.yml identity and the GitHub OIDC issuer, and with the identity of ci.yml it was refused (`no matching CertificateIdentity found`). The same held for the other five images. |
| Status | Pass |
| Remarks | Read-only check · Commit: d1e6c08 · Evidence: Release run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41777894521 (jobs Build and Publish); cosign verify from a laptop against GHCR, 4 Nov 2026 06:45 UTC · Defect: — |
| Executed By | Joash, via read-only checks (GitHub Actions logs, cosign) |
| Date of Execution | 2026-11-04 |
