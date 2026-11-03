# EN-21-T8 — documentation/supply-chain.md lets a newcomer verify an image's signature and SBOM

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T8 |
| Test Scenario | documentation/supply-chain.md lets a newcomer verify an image's signature and SBOM |
| Pre-conditions | 1. This pull request merged and a push to main has published and signed the images.<br>2. A machine with `cosign` installed and no GitHub login. |
| Test Steps | 1. Open documentation/supply-chain.md.<br>2. Follow the commands for one image: find the digest, `cosign verify`, `cosign verify-attestation`, extract the SBOM, and read a package list from it.<br>3. Repeat with a wrong identity and check it is refused. |
| Test Data | `ghcr.io/raphaelkwek/connectsphere-planning-core:<merge commit sha>`. |
| Expected Result | Each command works as written, the SBOM is extracted and readable, and the wrong identity is refused. |
| Acceptance criterion | A documentation/supply-chain.md explaining how to verify an image's signature and SBOM. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run against a published image, because none is signed yet. Partly proven: the action's verify step runs the guide's cosign verify and cosign verify-attestation commands with an exact identity, and the jq/base64 extraction of the SBOM from the attestation, on every pull request (EN-21-T5). Not proven: docker buildx imagetools to resolve a tag, cosign tree, and anonymous access to the GHCR package. |
| Status | Not Executed |
| Remarks | Commit: 11d972ed593bf4abc6f26115f75ffd246e071c14 · Evidence: documentation/supply-chain.md; the extraction and verification commands ran in https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41521790370 · Defect: —. Walk through the guide on a laptop after the first push to main. |
| Executed By |  |
| Date of Execution |  |
