# EN-21-T8 — documentation/supply-chain.md lets a newcomer verify an image's signature and SBOM

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T8 |
| Test Scenario | documentation/supply-chain.md lets a newcomer verify an image's signature and SBOM |
| Pre-conditions | 1. This pull request merged and a push to main has published and signed the images.<br>2. A machine with `cosign` installed and no GitHub login. |
| Test Steps | 1. Open documentation/supply-chain.md.<br>2. Follow the commands for one image: find the digest, `cosign verify`, `cosign verify-attestation`, extract the SBOM, and read a package list from it.<br>3. Repeat with a wrong identity and check it is refused. |
| Test Data | `ghcr.io/joass1/connectsphere-planning-core:<merge commit sha>`. |
| Expected Result | Each command works as written, the SBOM is extracted and readable, and the wrong identity is refused. |
| Acceptance criterion | A documentation/supply-chain.md explaining how to verify an image's signature and SBOM. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

> **Revised 2026-11-04.** The repository moved to `joass1/` on 4 Nov 2026, so the image is
> `ghcr.io/joass1/connectsphere-planning-core` and the guide's `OWNER` is `joass1` (corrected in
> documentation/supply-chain.md in the same change).

## Execution record

| Item | Content |
|---|---|
| Actual Result | On a laptop with cosign 3.1.4, jq 1.7.1 and crane 0.20.3 and no GitHub login, following documentation/supply-chain.md for ghcr.io/joass1/connectsphere-planning-core at d1e6c08: the tag resolved with the guide's `crane digest` alternative to sha256:fc6360104255…; `cosign verify` passed for the Release identity; `cosign verify-attestation --type cyclonedx` passed and wrote attestation.json; the jq and base64 commands extracted the SBOM (CycloneDX, 3,689 components) and printed its package list (e.g. `@babel/helper-string-parser@7.29.7`); `cosign tree` listed the signature and attestation referrers. With the ci.yml identity in place of release.yml, `cosign verify` was refused. As written, the guide's `OWNER=raphaelkwek` no longer finds the images since the repository moved to joass1; it is corrected to `OWNER=joass1` in the same change, and the run above used the corrected guide. `docker buildx imagetools` was not used (its `crane digest` alternative was). On Windows, jq's CRLF output made `base64 -d` print a warning; the SBOM still decoded. |
| Status | Pass |
| Remarks | Read-only check · Commit: d1e6c08 (images), guide as corrected in this pull request · Evidence: documentation/supply-chain.md; cosign, crane and jq against GHCR from a laptop, 4 Nov 2026 06:45 UTC · Defect: — (the guide's stale OWNER, fixed here) |
| Executed By | Joash, via the supply-chain guide on a laptop |
| Date of Execution | 2026-11-04 |
