# RegistrationInvariantCheckFailing: Registration invariant check failing (warning)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

`registration_invariant_check_success` has been 0 for 10 minutes: the over-admission check cannot run, so the zero over-admission SLI is unreadable. This is not a sign of over-admission; it is a sign we cannot tell.

## First checks

1. `curl -s http://registration:8092/readyz`. The usual cause is `database: unreachable`.
2. Check the registration service logs for connection errors, and whether the pooler is up.
3. If the database is fine, run the check's query by hand (see `backend/services/registration/src/overAdmission.ts`) and look for a permission or schema error after a migration.

## Mitigation

- Fix the connection. The gauge returns to 1 on the next scrape.
- If the schema changed, update the query in `overAdmission.ts`; do not delete the alert.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-over-admission.json](../../observability/grafana/dashboards/slo-over-admission.json) (`observability/grafana/dashboards/slo-over-admission.json`)
- SLO write-up: `documentation/slos.md`
