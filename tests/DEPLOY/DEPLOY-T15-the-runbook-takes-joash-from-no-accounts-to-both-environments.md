# DEPLOY-T15 — The runbook takes Joash from no accounts to both environments

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T15 |
| Test Scenario | The runbook takes Joash from no accounts to both environments |
| Pre-conditions | 1. documentation/deploy/README.md. |
| Test Steps | 1. Follow the runbook from the top: Oracle, Supabase, Vercel, GitHub environments, bootstrap, first Lead, first release.<br>2. Promote and roll back once. |
| Test Data | None. |
| Expected Result | Each step works as written, or the runbook is corrected. |
| Acceptance criterion | documentation/deploy/README.md is the runbook and Joash's checklist. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Not Executed |
| Remarks | Not run as a whole: following the runbook from the top means creating accounts and environments, and step 2 (promote and roll back once, through release.yml's workflow_dispatch with an earlier release) changes production; neither is a read-only check. The Azure part of the runbook was followed on 4 Nov to stand up both environments (documentation/evidence/DEPLOY/azure-first-deploy.md), and release.yml has never been dispatched to redeploy an earlier release. A walk-through by Joash is pending. · Defect: — |
| Executed By | — |
| Date of Execution | — |
