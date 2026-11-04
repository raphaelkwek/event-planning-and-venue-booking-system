# Staging sends its traces and metrics to Grafana Cloud

**Timestamp:** 2026-11-04T13:05+08:00 (SGT)
**Author:** Joash
**Reason:** EN-08 (#94) instrumented planning-core, notification and registration, but no deployed
environment exported anything: the VM deploy gate accepts only the settings it lists, and the OTEL
ones weren't there, so EN-08-T12 (the D4 approval as one trace in Grafana) couldn't be run.
**Scope:** `deploy/azure/connectsphere-vm-deploy`, `.github/workflows/deploy-vm-environment.yml`.
No service code changes.

## Added

- **The deploy gate** accepts three optional settings: `OTEL_EXPORTER_OTLP_ENDPOINT`,
  `OTEL_EXPORTER_OTLP_HEADERS` and `OTEL_RESOURCE_ATTRIBUTES`. None is required, so an environment
  without them deploys as before, and the services then export nothing (`documentation/observability.md`).
- **The release workflow** passes the environment's `OTEL_EXPORTER_OTLP_ENDPOINT` and
  `OTEL_EXPORTER_OTLP_HEADERS` secrets to the gate only when both are set, with
  `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=<staging|production>`. Each service names itself
  (`planning-core`, `notification`, `registration`).
- **Staging** has the two secrets (Joash's Grafana Cloud stack, region ap-southeast-1; the
  credentials were checked with an empty OTLP export, which Grafana accepted). Production has none
  yet. The fixed gate was installed on `connectsphere-vm` by hand, as on 4 Nov morning.
