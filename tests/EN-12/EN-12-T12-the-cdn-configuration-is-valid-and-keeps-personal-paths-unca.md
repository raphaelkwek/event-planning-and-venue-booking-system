# EN-12-T12 — The CloudFront configuration (as code) formats and validates, and its behaviours cache only what the contract allows

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T12 |
| Test Scenario | The CloudFront configuration (as code) formats and validates, and its behaviours cache only what the contract allows |
| Pre-conditions | 1. Dependencies installed (`npm ci`); for the Terraform steps, Terraform 1.9 (CI only). No AWS account is used and nothing is applied. |
| Test Steps | 1. Run `node --test gateway/tests/cdn.test.mjs`.<br>2. Run the `terraform fmt -check`, `terraform init -backend=false` and `terraform validate` steps of the `CDN configuration` job. |
| Test Data | gateway/cdn/terraform/*.tf |
| Expected Result | fmt and validate pass. Every personal path (registrations, waiting room, identity, event, venue, equipment, notification) uses the CachingDisabled policy; only `/registration/api/v1/open-events*` has a caching policy, with a maximum TTL of 5 seconds, no cookies and no query strings other than the paging ones; `/assets/*` uses a long TTL. No CDN is deployed: this proves the file is well formed, not that CloudFront serves it. |
| Acceptance criterion | A CDN in front of the SPA and the browse API (as code, validated only). |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | gateway/tests/cdn.test.mjs passed (5 tests) and the CDN configuration job ran terraform fmt -check, init -backend=false and validate successfully. Nothing was applied; no CDN is deployed. |
| Status | Pass |
| Remarks | Automated (CI step) · Commit: 0f598810aac420697e6b567bc3e616d7103af24c · Evidence: gateway/tests/cdn.test.mjs › EN-12-T12 caches only the browse API and the fingerprinted assets; gateway.yml › CDN configuration › terraform validate, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41529930983 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
