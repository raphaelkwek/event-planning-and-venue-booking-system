# Runbooks

One runbook per Prometheus alert (EN-17). CI checks that every alert in `observability/prometheus/rules/alerts.yml` has one here, with these sections: Symptoms, First checks, Mitigation, Escalation, Dashboards.

| Alert | Severity | Runbook |
|---|---|---|
| `RegistrationLatencyBurnFast` | critical | [RegistrationLatencyBurnFast.md](RegistrationLatencyBurnFast.md) |
| `RegistrationLatencyBurnSlow` | warning | [RegistrationLatencyBurnSlow.md](RegistrationLatencyBurnSlow.md) |
| `StaffApiLatencyBurnFast` | critical | [StaffApiLatencyBurnFast.md](StaffApiLatencyBurnFast.md) |
| `StaffApiLatencyBurnSlow` | warning | [StaffApiLatencyBurnSlow.md](StaffApiLatencyBurnSlow.md) |
| `NotificationFreshnessBurnFast` | critical | [NotificationFreshnessBurnFast.md](NotificationFreshnessBurnFast.md) |
| `NotificationFreshnessBurnSlow` | warning | [NotificationFreshnessBurnSlow.md](NotificationFreshnessBurnSlow.md) |
| `AvailabilityBurnFast` | critical | [AvailabilityBurnFast.md](AvailabilityBurnFast.md) |
| `AvailabilityBurnSlow` | warning | [AvailabilityBurnSlow.md](AvailabilityBurnSlow.md) |
| `RegistrationOverAdmission` | critical | [RegistrationOverAdmission.md](RegistrationOverAdmission.md) |
| `RegistrationInvariantCheckFailing` | warning | [RegistrationInvariantCheckFailing.md](RegistrationInvariantCheckFailing.md) |
| `ServiceMetricsMissing` | warning | [ServiceMetricsMissing.md](ServiceMetricsMissing.md) |
