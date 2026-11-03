# DEPLOY-T2 — A merge to main pushes each image once to GHCR as one multi-arch index, signs it keylessly and attests its SBOM

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T2 |
| Test Scenario | A merge to main pushes each image once to GHCR as one multi-arch index, signs it keylessly and attests its SBOM |
| Pre-conditions | 1. A pull request has been merged to main.<br>2. The Release workflow ran on that push. |
| Test Steps | 1. Open the Release run for the merge commit.<br>2. Check `Build (<image>, <arch>)` pushed one digest per image and architecture, and `Publish (<image>)` joined them into `ghcr.io/raphaelkwek/connectsphere-<image>:<sha>`.<br>3. Check the publish step signed the index digest, attested its CycloneDX SBOM and verified both for the identity `.github/workflows/release.yml@refs/heads/main`.<br>4. Run `cosign verify` from documentation/supply-chain.md against one digest yourself. |
| Test Data | The merge commit's images in GHCR. |
| Expected Result | One index per image, built once, signed and attested; a wrong identity is refused. |
| Acceptance criterion | Every merge to main builds the images once, signs them (cosign keyless) and attests an SBOM. |
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
