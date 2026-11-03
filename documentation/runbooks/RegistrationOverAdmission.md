# RegistrationOverAdmission: Registration over-admission (critical)

Alert rule: `observability/prometheus/rules/alerts.yml`. SLO definitions: `documentation/slos.md`.

## Symptoms

`registration_over_admission_seats` is above 0: the seat table holds a row that breaks the one-seat-one-holder rule (a claimed seat with no holder, or a seat number twice in a booking). The schema is meant to make this impossible, so a constraint has been dropped, left NOT VALID or bypassed. The SLO is zero.

## First checks

1. Do not touch the data yet. Read the gauge's value on the dashboard; it counts rows.
2. Find the rows (read-only, on the registration database):
   `select * from registration.seats where status = 'CLAIMED' and claimed_by is null;`
   `select booking_id, seat_no, count(*) from registration.seats group by 1, 2 having count(*) > 1;`
3. Check the constraints still exist and are validated: `select conname, convalidated from pg_constraint where conrelid = 'registration.seats'::regclass;`. A missing `seats_booking_id_seat_no_key` or a `convalidated = false` is the cause.
4. Check recent migrations and any manual SQL run against the database.

## Mitigation

- Stop new registrations for the affected event if you can (an event status change, not a delete).
- Restore the constraint in a forward migration (add `NOT VALID`, clean the rows, then validate), as the migration rules require. Never drop rows in place without writing down which attendees held them.
- Tell the affected attendees' event owner before anyone is turned away. This is a possible personal-data and fairness incident: log it under the PDPA breach procedure if any attendee data was exposed or altered.

## Escalation

1. Page the service owner: the author of the last change to the service (`git log -5 --format='%an %s' -- <service dir>`).
2. If nobody answers in 15 minutes, or the alert is critical and still firing after your first mitigation, escalate to Joash (observability owner) and the Scrum Master.
3. Write what you saw and did in the team channel as you go: the next person starts from your notes.

## Dashboards

- [slo-over-admission.json](../../observability/grafana/dashboards/slo-over-admission.json) (`observability/grafana/dashboards/slo-over-admission.json`)
- SLO write-up: `documentation/slos.md`
