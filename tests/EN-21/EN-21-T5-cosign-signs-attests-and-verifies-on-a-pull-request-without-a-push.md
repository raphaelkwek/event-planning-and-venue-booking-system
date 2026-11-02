# EN-21-T5 — A pull request signs the SBOMs as blobs, and signs, attests and verifies an image in a throwaway local registry

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T5 |
| Test Scenario | A pull request signs the SBOMs as blobs, and signs, attests and verifies an image in a throwaway local registry |
| Pre-conditions | 1. A pull request from a branch of this repository, so the workflow token gets an OIDC token (`id-token: write`). A fork's run cannot, and the step then says so.<br>2. The five images build on the runner. |
| Test Steps | 1. Open each `Image (...)` job of the Supply chain run.<br>2. Read `Sign the SBOM as a blob (cosign sign-blob, keyless)` and `Verify the SBOM signature (cosign verify-blob)`.<br>3. Read `Sign, attest and verify an image in a local registry`: the job pushes the image to a registry service container on localhost and runs the same composite action `.github/actions/sign-and-attest` that Deploy runs on main, then `cosign verify` and `cosign verify-attestation` with the workflow identity.<br>4. Check the negative case: `cosign verify` with a different identity must fail. |
| Test Data | The pull request's merge ref as the signing identity (`.../supply-chain.yml@refs/pull/<n>/merge`); no key, no secret. |
| Expected Result | The SBOM blob signature verifies. The image in the local registry has a signature and a CycloneDX attestation that verify against this workflow's identity and the GitHub OIDC issuer. Verification with a wrong identity is refused. Nothing is pushed to GHCR. |
| Acceptance criterion | cosign: on pull requests there is no push, so cosign sign-blob signs the SBOMs as a demonstration and a cosign verify step follows. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
