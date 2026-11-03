# DEPLOY-T6 — cert-manager issues the API certificate from the ClusterIssuer the Ingress names, and Traefik serves it over HTTPS

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T6 |
| Test Scenario | cert-manager issues the API certificate from the ClusterIssuer the Ingress names, and Traefik serves it over HTTPS |
| Pre-conditions | 1. The `kind: k3s staging overlay` job runs. It stands in a self-signed ClusterIssuer named `letsencrypt` for Let's Encrypt. |
| Test Steps | 1. Check the Certificate cert-manager made from the Ingress became Ready and its Secret is the overlay's TLS Secret name.<br>2. Check the certificate Traefik presents for the API host names that host.<br>3. Check plain HTTP on port 80 does not reach the API. |
| Test Data | None. |
| Expected Result | Steps 1 to 3 hold. Not shown: the ACME HTTP-01 exchange with Let's Encrypt itself, which needs a public address (DEPLOY-T12). |
| Acceptance criterion | Traefik ingress with cert-manager and Let's Encrypt. |
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
