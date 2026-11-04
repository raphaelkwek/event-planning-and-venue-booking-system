# Operations evidence: observability, deployment pipeline and Cerbos access control, captured from the live system

**Timestamp:** 2026-11-04T19:45+08:00 (SGT)
**Author:** Joash
**Scope:** `documentation/evidence/operations/` (new), `documentation/scripts/submission-package.ts` and its test,
`documentation/scripts/build-submission.ts` (usage text).

## Added

- **`documentation/evidence/operations/`**: 26 numbered captures of the running system, with a `README.md` giving
  for each one what it shows, when it was captured and the URL or command it came from.
  - Observability: the live overview for staging and production, the public dashboard, an Explore query of
    `http_requests_total` by service and environment, the availability, staff-API and registration SLO dashboards,
    and the EN-08 trace (rendered by Grafana Cloud's image renderer).
  - Deployment pipeline: a green Release run (build → publish and sign → staging → approved production), Release #18
    held at the production approval gate, a green CI run on main (196 of 196 browser tests), branch protection and
    the environments' required reviewer from the GitHub API, the Azure VM's health for both environments, and the
    two sign-in pages.
  - Access control (EN-07): six staff menus and the attendee's layout, the live
    `POST /identity/api/v1/permissions/check` answers for seven roles, an attendee sent away from `/#/queue`, the same
    API call refused with 403 `ROLE_NOT_AUTHORISED` for an attendee and answered for a coordinator, a policy excerpt,
    and Cerbos's health from inside the container.
  - Performance and lifecycle, and the live system: staging's p95 before and after its database moved to Singapore,
    the completed event's status history, the review queue, a venue calendar, an equipment check and an attendee's
    registrations.
- **`Operations Evidence - ConnectSphere.pdf`** (made outside the repo, 24 pages): the same images with a caption
  each, plus the measured p95 table and the completed-event timeline.
- **Week 12 zip:** folder 2 gains "Operations Screenshots" (from `documentation/evidence/operations`). The builder
  also copies `Operations Evidence - ConnectSphere.pdf` into folder 2 and `Sprint Velocity and Burndowns -
  ConnectSphere.pdf` into folder 4 from `--deliverables`, each as a manifest part (`DELIVERABLE_PDFS`); a PDF that
  is not there is marked missing. Tests first: `submission-package.test.ts` pins the folder-2 list and checks both
  the copy and the missing case.

## Not captured

The notification-freshness and zero over-admission SLO dashboards had no data in the window, and the Lead had no
notifications on staging (every event there was submitted before the D3 notices were merged), so neither is shown.
