# EN-21-T7 — Every third-party action the supply-chain pipeline adds is pinned by commit SHA

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-21-T7 |
| Test Scenario | Every third-party action the supply-chain pipeline adds is pinned by commit SHA |
| Pre-conditions | 1. A pull request or push to main. |
| Test Steps | 1. Open the job `Actions are pinned by commit SHA` of the Supply chain run.<br>2. Read the step: `node .github/scripts/check-action-pins.mjs` reads `.github/workflows/supply-chain.yml`, `.github/workflows/deploy.yml` and `.github/actions/**/action.yml`, and fails on any `uses:` that is not a 40-hex commit or a local path. |
| Test Data | The workflow and the composite action at the commit under test. |
| Expected Result | The job passes and prints each pinned action with its SHA. A `uses:` pinned to a tag or branch would fail it. |
| Acceptance criterion | Pin the third-party GitHub Actions you add by commit SHA. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The job printed every action in supply-chain.yml, deploy.yml and the composite action with its 40-character SHA, and the self-test showed an action pinned to a tag is refused for the right reason. |
| Status | Pass |
| Remarks | Commit: 11d972ed593bf4abc6f26115f75ffd246e071c14 · Automated (CI) · Evidence: .github/scripts/check-action-pins.mjs › job 'Actions are pinned by commit SHA', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41521790370 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
