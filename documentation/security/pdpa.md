# PDPA review of attendee personal data (EN-23)

**Author:** Joash · **Date:** 2026-11-02 · **Jira:** EN-23 · **Companion documents:** [`threat-model.md`](threat-model.md), [`asvs-l2.md`](asvs-l2.md)

This note applies Singapore's Personal Data Protection Act 2012 (PDPA) to the personal data of attendees in ConnectSphere. It is an engineering review of what the system does, not legal advice: the team should confirm the points marked "decision needed" with whoever advises the course on compliance before any real attendee uses the system.

## What attendee data exists today, and what is planned

| Data | Where | Status |
|---|---|---|
| Email address, display name, active flag, last sign-in time | `identity.users` (`backend/services/planning-core/migrations/identity/0001_init_identity_schema.sql:6`, `backend/services/planning-core/migrations/identity/0002_add_user_display_name.sql:4`) | Built. Attendees are users with the `ATTENDEE` role (`backend/services/planning-core/migrations/identity/0001_init_identity_schema.sql:20`). |
| Every sign-in attempt, including the email typed for an unknown account | `identity.login_audit` (`backend/services/planning-core/migrations/identity/0001_init_identity_schema.sql:32`) | Built. |
| The attendee's user id on a claimed seat, and when | `registration.seats` (`backend/services/registration/migrations/0001_init_registration_schema.sql:45`) | Built. Ids only, no name. |
| The attendee's notifications: the recipient's id and a message | `notification.notifications` (`backend/services/notification/migrations/0001_init_notification_schema.sql:23`, `backend/services/notification/migrations/0001_init_notification_schema.sql:30`) | Built. Staff-facing today (organiser and coordinator messages); attendee messages arrive with R2. |
| Registrations: attendee, event, status, timestamps, withdrawal | Registration database | Not built (R2 to R7). |
| Free-text contact details of an event's organiser: "a name, email and phone number" | `event.events.contact_details` (`backend/services/planning-core/migrations/event/0009_event_contact_details_and_version.sql:6`) | Built. This is organiser data, not attendee data, but it is the only free-text personal field. |
| Passwords | Supabase Auth only | Never stored by ConnectSphere's code; the login route forwards them to Supabase (`backend/services/planning-core/src/modules/identity/auth/supabaseAuthClient.ts:15`). |

No NRIC or other national identifier, phone number, date of birth or dietary information is collected by any table or screen (a search of the migrations and services finds none). Keep it that way: the PDPC's advisory guidelines restrict collecting NRIC numbers.

## Obligations

Each obligation below says what the system does, with a citation, and what is missing.

### Consent

- **What the system does.** Nothing. There is no sign-up screen, no consent record and no privacy notice anywhere in the frontend or the services. Accounts are created by the team's seed script or in Supabase (`backend/services/planning-core/migrations/identity/seed/seed-auth-users.ts:23`).
- **Missing.** A sign-up flow that records consent: who, when, which version of the notice and what purpose. Needed before R2 ships. For staff, consent can rest on the employment or engagement relationship; for attendees it cannot be assumed. *Decision needed:* whether registering for an event counts as consent to the notifications and organiser reports in R5, or whether those need a separate opt-in.

### Purpose limitation

- **What the system does.** The tables hold only what the stories need: an email and a name to sign in and be named, a user id on a seat, a message per notification. Other services store ids only and ask identity for names (`backend/services/planning-core/src/modules/identity/api/users.ts:8`). Nothing is used for marketing or analytics.
- **Missing.** The purposes are not written down anywhere an attendee can read. R5 shows organisers "who has registered" (`documentation/final user stories.md`, story R5): decide which fields an organiser may see, and say so in the notice. The Kafka log and the Grafana dashboards must never carry attendee names or emails: the dashboards added by EN-17 use only counts and route names.

### Notification

- **What the system does.** Nothing visible to the attendee.
- **Missing.** A notice, shown before or at sign-up, that states the purposes, who receives the data (the organiser of an event the attendee registers for, and ConnectSphere's staff) and how to reach the data protection officer. Add a link in the footer of the attendee app (EN-13 shell) and in the confirmation email.

### Access

- **What the system does.** A signed-in user can read only their own notifications (`backend/services/notification/src/repo/notifications.ts:54`). The story for R3 lets an attendee see their own registrations. There is no route that exports everything held about a person.
- **Missing.** A procedure, and ideally a route, to give a person a copy of their data on request within 30 days: identity row, sign-in audit rows, seats and registrations, notifications. A staff-run SQL script is enough for the first version if it is written down and tested.

### Correction

- **What the system does.** Nothing for attendees. Display names are set in the database or Supabase. Staff correct event data through the event edit route.
- **Missing.** A way for an attendee to correct their name and email. Email changes must go through Supabase Auth so the sign-in and the identity row stay in step. Until then, a documented staff procedure.

### Accuracy

- **What the system does.** Email is validated as an email address at sign-in (`backend/services/planning-core/src/modules/identity/api/auth.ts:11`) and is unique (`backend/services/planning-core/migrations/identity/0001_init_identity_schema.sql:6`). Event edits use a version check so a stale edit cannot overwrite a newer one (`backend/services/planning-core/src/modules/event/api/eventDetails.ts:75`).
- **Missing.** Email ownership is not verified by the code; that depends on Supabase's confirmation setting, which is not in the repository. *Verify* the setting before attendees register.

### Protection

- **What the system does.** Access is checked on the server for every route (`backend/services/planning-core/src/modules/event/auth/actor.ts:64`). Transport uses TLS to Kafka (`backend/packages/kafka/src/config.ts:46`). Passwords never reach our database. Notifications are limited to the recipient (`backend/services/notification/src/repo/notifications.ts:80`). Secrets are not committed and every commit is scanned (`.github/workflows/ci.yml:213`).
- **Missing.** The high-severity items in `threat-model.md` all matter here: no rate limit on 20 routes (G2), stack traces and database errors returned to clients (G3), no row-level security and a single database credential (G5), no MFA for staff (G9), and no encryption-at-rest evidence beyond the provider's defaults. Seat and registration data should sit behind the same fixes before real attendees are loaded.

### Retention limitation

- **What the system does.** Nothing deletes anything. The team rule is "No `DELETE`, ever" (`documentation/planning/implementation.md:732`) and R4 says a withdrawn registration is "retained, not deleted" (`documentation/final user stories.md:890`). `login_audit` grows without a limit and keeps the email typed for unknown accounts (`backend/services/planning-core/src/modules/identity/repo/loginAudit.ts:9`). Notifications are never purged.
- **Missing.** A retention schedule and a job that applies it. Suggested starting point, to be confirmed: sign-in audit 12 months; notifications 12 months after the event; registrations and seat claims 12 months after the event ends, then anonymise (replace the user id with a tombstone) instead of deleting rows, so the no-`DELETE` rule and the PDPA both hold; accounts that have been inactive for 24 months deactivated and then anonymised. This conflicts with the story wording "retained, not deleted" only if retention is read as "forever": raise it with the product owner.

### Transfer limitation

- **What the system does.** The container design says AWS ap-southeast-1 (Singapore) "keeps data in Singapore under PDPA" (`documentation/adr/0012-containers-kubernetes-gitops-terraform.md:17`), but that is a design, not a deployment.
- **Missing.** The development services are hosted elsewhere and their regions are not recorded in the repository: Supabase (`.env.example:38`), Kafka (Aiven then Confluent Cloud, `documentation/adr/0008-kafka-cdc-outbox-cloudevents-schema-registry.md:58`) and Temporal Cloud. If any of them is outside Singapore, a transfer of personal data happens when a real attendee registers, and the PDPA then requires the recipient to give comparable protection. Record the region of each in the deployment notes, choose Singapore regions where the plan allows, and keep personal data out of Kafka payloads and Temporal inputs (today only a coordinator's display name travels, `backend/packages/contracts/src/eventEvents.ts:47`).

### Data breach notification

- **What the system does.** Nothing. There is no breach procedure, no alert tied to data access, and the logs are on standard output only. The EN-17 alerts watch availability and over-admission, not data disclosure.
- **Missing.** A written procedure: contain, assess within 30 days whether the breach is notifiable (significant harm to individuals, or affecting 500 or more people), and tell the PDPC and affected individuals as soon as practicable and within 3 calendar days of that assessment. Name who assesses and who notifies. Add the runbook `documentation/runbooks/RegistrationOverAdmission.md` step "log it under the breach procedure" to that procedure when it exists.

### Accountability

- **What the system does.** The team documents decisions as ADRs and keeps this review.
- **Missing.** A named data protection officer, with a contact address published in the notice; a record of the personal data held (this note is the start of it); a policy for handling access and correction requests; and a staff briefing before real data is loaded. *Decision needed:* who the DPO is for the project.

## Summary of what to do first

1. Name the DPO and write the privacy notice (accountability, notification, consent).
2. Write the breach procedure (data breach notification).
3. Record the region of Supabase, Kafka and Temporal and choose Singapore regions where possible (transfer limitation).
4. Define the retention schedule and the anonymise-not-delete job (retention limitation).
5. Write the export and correction procedure for an attendee (access and correction).
6. Fix the security gaps G2, G3, G5 and G9 before any real attendee data is loaded (protection).
