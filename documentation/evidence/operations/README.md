# Operations evidence: observability, deployment pipeline, access control, the live system

**Author:** Joash · **Captured:** 4 November 2026 (times below are SGT) · **PDF:** `Operations Evidence - ConnectSphere.pdf`
in folder 2 of the Week 12 zip, with a caption under each image.

Every image is a capture of the real system: Grafana Cloud pages rendered by Grafana's own image renderer
(`/render/...` on stack `wiselasagna1171`), public web pages taken with Playwright (Chromium, signed out or signed
in to staging as a seeded account), or a command's output or API answer copied verbatim into a page and
screenshotted. Captures were only cropped; nothing inside the kept area was edited. Nothing was created, changed or
deleted to take them: staging was only viewed, the API console sent `GET` requests, and the equipment check creates no
reservation. No token, key or connection string appears in any image. Staging's data is the demo seed made after its
database moved to Singapore (Supabase `ap-southeast-1`) at about 15:45 SGT; every staging capture is later than that.

| # | File | What it shows | Captured | Where (URL or command) |
|---|---|---|---|---|
| 1 | `01-grafana-live-overview-staging.png` | Live overview, staging: request rate, 5xx share, p95 by service, status classes, Kafka lag and publishes, busiest routes, recent traces | 16:59, last 8 h | Grafana dashboard `cs-live-overview`, `var-env=staging` |
| 2 | `02-grafana-live-overview-production.png` | The same dashboard for production: little traffic (no demo data), same telemetry pipeline | 16:59, last 8 h | `cs-live-overview`, `var-env=production` |
| 3 | `03-grafana-public-dashboard.png` | The shared overview anyone can open without a login, both environments; its trace table does not render in a public dashboard, so it is cropped off | 19:33, last 8 h | https://wiselasagna1171.grafana.net/public-dashboards/f8f82a13a4f645dbae830cdbc8f49b77 |
| 4 | `04-grafana-explore-requests-by-service-and-environment.png` | Explore: `sum by (service, deployment_environment) (rate(http_requests_total{…}[5m]))` | 17:00, last 12 h | Grafana Explore, data source `grafanacloud-prom` |
| 5 | `05-grafana-slo-availability.png` | Availability SLO: 0 % errors in the last hour, 100 % over 28 days; “Scrape targets up” is empty because the services push metrics over OTLP rather than being scraped | 16:59, last 8 h | `cs-slo-availability` |
| 6 | `06-grafana-slo-staff-api-latency.png` | Staff API latency SLO: 0 % slow now; the 28-day budget is negative from the load run on the Tokyo database (see image 21) | 16:59, last 8 h | `cs-slo-staff-api` |
| 7 | `07-grafana-slo-registration-latency.png` | Registration latency SLO: 0 % slower than 800 ms now; budget spent during the Tokyo period | 16:59, last 8 h | `cs-slo-registration` |
| 8 | `08-grafana-trace-d4-approval.png` | One trace of a coordinator's approval across the services, with each database call (copy of EN-08-T12's screenshot) | 13:44 | Grafana Explore, Tempo, trace `a82bfe6d…1ac66` (`documentation/evidence/EN-08/`) |
| 9 | `09-github-release-run-green.png` | Release #17 on main: 12 builds → 6 publishes (signed with cosign, SBOM attested) → release → staging → production, approved by joass1 | 17:04 | https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41777894521 |
| 10 | `10-github-release-production-approval-gate.png` | Release #18: staging deployed, production waiting for a required reviewer (“production require an approval”) | 17:04 | https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41785299166 |
| 11 | `11-github-ci-run-green.png` | CI #626 on main: lint, typecheck, unit, integration, browser tests (196 passed), gitleaks, observability, traceability | 17:04 | https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801004515 |
| 12 | `12-github-branch-protection-and-environments.png` | Branch protection of `main` and the two deployment environments, from the REST API | 19:28 | `gh api repos/joass1/event-planning-and-venue-booking-system/branches/main/protection`, `…/environments`, `…/environments/<name>/deployment-branch-policies` |
| 13 | `13-azure-vm-health-staging-and-production.png` | Both containers on the Azure VM: `/readyz` of each service (database ok, Kafka reachable), Cerbos serving, every process running | 19:28 | `ssh azureuser@4.194.57.47 'sudo -u cs-deploy /usr/local/bin/connectsphere-vm-deploy <env> health'` |
| 14 | `14-live-sign-in-pages.png` | Production's sign-in page (no seeded list) beside staging's (seeded test accounts) | 17:03 | https://connectsphere-is212.vercel.app, https://connectsphere-staging.vercel.app |
| 15 | `15-cerbos-navigation-by-role.png` | The staff menu of six roles and the attendee's layout, each built from the Cerbos answer | 17:07–17:09 | staging, signed in as each `<role>@connectsphere.test` |
| 16 | `16-cerbos-permission-answers-by-role.png` | The 28 answers of `POST /identity/api/v1/permissions/check` for each of seven roles, as the browser received them | 17:07–17:09 | staging, the sign-in's own request, recorded by Playwright |
| 17 | `17-cerbos-attendee-sent-away-from-staff-route.png` | An attendee opening `/#/queue` ends on `/#/open-events` | 17:10 | staging, attendee@connectsphere.test |
| 18 | `18-cerbos-api-403-vs-200.png` | The same `GET /venue/api/v1/venues/search` from the API console: 403 `ROLE_NOT_AUTHORISED` for the attendee, 200 for the coordinator | 17:10–17:11 | staging, `/#/console` |
| 19 | `19-cerbos-policy-excerpt.png` | Excerpts of `policies/resources/event.yaml` and `policies/derived_roles/connectsphere.yaml` | 19:28 | the repository at this commit |
| 20 | `20-cerbos-health-serving.png` | Cerbos's health endpoint from inside the staging container: `{"status":"SERVING"}` | 19:28 | `ssh azureuser@4.194.57.47 'docker exec connectsphere-staging curl -s http://127.0.0.1:3592/_cerbos/health'` |
| 21 | `21-grafana-staging-p95-database-move.png` | p95 of planning-core's GET requests on staging: about 1.3–1.5 s under load on the Tokyo database, mostly under 0.3 s after the move to Singapore (the gap is the move) | 17:00, 13:00 to 17:00 | Grafana Explore, `histogram_quantile(0.95, … http_request_duration_seconds_bucket{service="planning-core",deployment_environment="staging",method="GET"} …)` |
| 22 | `22-completed-event-status-history.png` | EVT-000016 from Draft to Completed; the last step, Confirmed → Completed, made by System at the event's end time | 19:26 | staging, organiser@, `/#/requests/00dc685d-e82c-41d4-86d7-5b08a1295357` |
| 23 | `23-staging-coordinator-review-queue.png` | The coordinator's review queue | 17:12 | staging, coordinator@, `/#/queue` |
| 24 | `24-staging-venue-availability-calendar.png` | A venue's calendar: setup, confirmed booking and turnaround of EVT-000011 on 12 Jan 2027 | 19:25 | staging, coordinator@, `/#/venues/6249364a-…/availability`, 10–16 Jan 2027 |
| 25 | `25-staging-equipment-availability-check.png` | Equipment check: 2 portable PA systems for 12 Jan 2027 14:00–18:00, 3 available, no shortfall | 19:26 | staging, techsupport@, `/#/equipment/availability` |
| 26 | `26-staging-attendee-registrations.png` | An attendee's registration and waitlist place | 17:12 | staging, attendee@, `/#/my-registrations` |

## Not captured

- The **notification-freshness** and **zero over-admission** SLO dashboards showed “No data” for the last 8 hours, so
  they are left out.
- The **Lead's notifications** were empty: every event on staging was submitted at about 15:37 SGT, before the D3
  notices (“waiting in your unassigned queue”, #117) were merged at 16:07 SGT, so none was written.
