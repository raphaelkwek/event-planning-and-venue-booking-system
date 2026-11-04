/*
 * ConnectSphere: C4 model (EN-09, SPM-127), brought up to date on 4 Nov 2026.
 * Rendered in CI by .github/workflows/diagrams.yml; README.md has the steps.
 * Source of truth: ADR-0004 to ADR-0016 (documentation/adr/) and the code.
 * "Planned" now marks only what is not built (email, the AWS scale-up).
 * "CiOnly" marks what is built and tested in CI but runs in no deployed
 * environment (Kong). Dashed elements are not serving users anywhere.
 * Deployment views: Development, Staging, Production, ContinuousIntegration, AwsScaleUp.
 */
workspace "ConnectSphere" "Event planning and venue booking for ConnectSphere-managed venues." {

    !identifiers hierarchical

    model {
        organiser = person "Event Organiser" "Requests events and follows them through approval."
        coordinator = person "Event Coordinator" "Reviews requests, plans events, books venues and equipment."
        venueStaff = person "Venue Staff" "Maintains venues and decides booking requests."
        techSupport = person "Technical Support Staff" "Maintains equipment and arranges reservations."
        attendee = person "Attendee" "Browses open events and registers."
        lead = person "Event Coordinator Lead" "Assigns new requests to coordinators and oversees their workload (CR-05)."
        safetyOfficer = person "Safety Officer" "Runs the Operational Safety Check before an event proceeds to preparation (CR-06)."

        supabaseAuth = softwareSystem "Supabase Auth" "Issues and verifies sign-in tokens (JWT, MFA for staff)." {
            tags "External"
        }
        email = softwareSystem "Email provider" "Delivers notifications by email. A stretch goal behind an adapter; no sender is built (notifications are in-app only)." {
            tags "External" "Planned"
        }
        grafana = softwareSystem "Grafana Cloud" "Receives traces and metrics over OTLP (ADR-0013). Opt-in: a service exports only when OTEL_EXPORTER_OTLP_ENDPOINT is set; otherwise it keeps correlation ids and discards spans (EN-08)." {
            tags "External"
        }

        connectsphere = softwareSystem "ConnectSphere" "Manages an event's lifecycle: request, review, venue booking, equipment, registration and change." {

            staffConsole = container "Staff console" "Every internal role's screens: requests, review queue, venues, equipment, change requests. Served as a static bundle by Vercel." "React 18, Atlaskit, Vite" {
                tags "Web"
            }
            attendeeApp = container "Attendee app" "Browse open events, the waiting room, register, manage my registrations (R1 to R4, EN-19). The attendee routes of the same SPA build as the staff console, scoped by role; the installable PWA of ADR-0014 is not built." "React 18, Vite (EN-13)" {
                tags "Web"
            }
            gateway = container "API gateway" "Checks JWTs, rate-limits per user and address in Redis, stamps trace headers, routes (ADR-0011, EN-12). Config, rendering and CDN code are built and exercised in CI (gateway.yml); no deployed environment runs Kong. There the SPA calls the services' public prefixes through Caddy and each route has its own in-process limiter." "Kong 3.9, Redis (EN-12)" {
                tags "CiOnly"
            }

            core = container "planning-core" "The staff-facing deployable. Rules that span modules (F4, F5, S2/S3, G2) are one Postgres transaction (ADR-0004). Asks Cerbos before it acts and has row-level security on event data (ADR-0010)." "Node.js 20, Express 4, TypeScript" {
                identity = component "Identity module" "Login (A1), roles (A2, including the Event Coordinator Lead and Safety Officer from CR-05 and CR-06), access scope (A3, A4). Public interface: lookUpCaller, resolveAccessScope." "modules/identity"
                event = component "Event module" "Requests, drafts, review, clarification, assignment, the guarded status lifecycle (B1 to G2), the event stream (EN-03). Public interface: findEventForPlanning." "modules/event"
                venue = component "Venue module" "Catalogue, setup and turnaround times, calendar, search, suitability, holds with expiry, and one or more bookings per event (H1 to N2, CR-01 to CR-04). Owns the venue slot exclusion constraint on occupied periods (ADR-0006)." "modules/venue"
                equipment = component "Equipment module" "Requests, availability, reservations (O1 to Q2). Per-unit exclusion constraint, bulk type lock and peak check." "modules/equipment"
                change = component "Change and readiness module" "Confirmation readiness (F5), the Operational Safety Check (U1, CR-06) and change requests with impact flags (S1 to S3)." "modules/change"
            }

            registration = container "registration-service" "Seat inventory, registrations, the waitlist, manual additions and the waiting room (R1 to R7, EN-19). Seats are rows claimed with SKIP LOCKED (ADR-0005). Builds its event listings from Kafka." "Node.js 20, Express 4, TypeScript (EN-13)"
            notification = container "notification-service" "Notification records and read state (T2). Consumes events through an inbox, with retries and a DLQ (ADR-0008)." "Node.js 20, Express 4, TypeScript (EN-04.3)"
            workers = container "Workflow workers" "Planning-core's Temporal worker: CompleteEvent (starts from event.confirmed) and HoldExpiry (reminder and expiry timers per hold, CR-04). Cancellation is not a workflow: it is one core transaction (ADR-0009 implementation note). The activities call the event and venue modules' functions in the same codebase." "Temporal TypeScript SDK 1.24 (EN-11)"
            cerbos = container "Policy decision point" "Answers 'may this role do this action?' from the policy files in policies/ (ADR-0010, EN-07). Planning-core asks it on every route." "Cerbos 0.56 (EN-07)"

            coreDb = container "Core database" "One schema per module: identity, event, venue, equipment, change. Every invariant is a constraint or a row lock (ADR-0006); row-level security on event and assignment rows (EN-07)." "Supabase Postgres" {
                tags "Database"
            }
            registrationDb = container "Registration database" "registration schema: seats, registrations, waitlist, waiting room, inbox, outbox." "Supabase Postgres" {
                tags "Database"
            }
            notificationDb = container "Notification database" "notification schema: notifications, read state, inbox." "Supabase Postgres" {
                tags "Database"
            }
            kafka = container "Event log" "Domain events: one topic per aggregate, CloudEvents envelope, outbox in and inbox out (ADR-0008). Development uses the team's hosted Kafka cluster; staging and production run one Redpanda broker each, with SASL/SCRAM over TLS (ADR-0016). Schema compatibility is checked in CI (EN-05)." "Kafka API: hosted Kafka (development), Redpanda (staging, production)" {
                tags "Queue"
            }
            temporal = container "Workflow engine" "Durable workflow state and timers. Development uses a hosted namespace; staging and production run the Temporal dev server with SQLite on the container's disk, so timers and running workflows do not survive a restart (ADR-0016)." "Temporal"
        }

        # People use the two front ends
        organiser -> connectsphere.staffConsole "Requests and tracks events in" "HTTPS"
        coordinator -> connectsphere.staffConsole "Reviews, plans and cancels events in" "HTTPS"
        venueStaff -> connectsphere.staffConsole "Maintains venues and decides bookings in" "HTTPS"
        techSupport -> connectsphere.staffConsole "Maintains equipment and arranges reservations in" "HTTPS"
        attendee -> connectsphere.attendeeApp "Browses and registers in" "HTTPS"
        lead -> connectsphere.staffConsole "Assigns and reassigns coordinators, and oversees workload in" "HTTPS"
        safetyOfficer -> connectsphere.staffConsole "Approves, rejects or requests changes to events' safety arrangements in" "HTTPS"

        # Sign-in
        connectsphere.staffConsole -> supabaseAuth "Signs users in with" "HTTPS"
        connectsphere.attendeeApp -> supabaseAuth "Signs attendees in with" "HTTPS"
        connectsphere.core -> supabaseAuth "Checks passwords, revokes sessions and verifies tokens with" "HTTPS, JWKS"

        # Front ends to the backend. Development, staging and production call the services directly
        # (Vite proxy or Caddy); the gateway is not in that path (see its description).
        connectsphere.staffConsole -> connectsphere.core "Calls the /identity, /event, /venue and /equipment APIs of" "JSON/HTTPS"
        connectsphere.staffConsole -> connectsphere.registration "Reads and manages registrations (R5 to R7) through" "JSON/HTTPS"
        connectsphere.staffConsole -> connectsphere.notification "Reads notifications from" "JSON/HTTPS"
        connectsphere.attendeeApp -> connectsphere.core "Signs in and reads its profile through" "JSON/HTTPS"
        connectsphere.attendeeApp -> connectsphere.registration "Browses, registers, withdraws and joins the waiting room through" "JSON/HTTPS"
        connectsphere.attendeeApp -> connectsphere.notification "Reads notifications from" "JSON/HTTPS"

        # The edge, as built and tested in CI
        connectsphere.gateway -> connectsphere.core.identity "Routes /api/v1/auth, /users and /access-scope to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.core.event "Routes /api/v1/events to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.core.venue "Routes venue routes to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.core.equipment "Routes equipment routes to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.registration "Routes /api/v1/registrations and the waiting room to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.notification "Routes /api/v1/notifications to" "JSON/HTTPS"

        # Inside planning-core: function calls through each module's index.ts, never HTTP (ADR-0004)
        connectsphere.core.event -> connectsphere.core.identity "Resolves the caller and the A3 scope through" "Function call"
        connectsphere.core.venue -> connectsphere.core.event "Reads event timing and requirements (K1, J1) through" "Function call"
        connectsphere.core.equipment -> connectsphere.core.event "Reads event timing (O1) through" "Function call"
        connectsphere.core.change -> connectsphere.core.venue "Reads the booking for readiness (F5) through" "Function call, same transaction"
        connectsphere.core.change -> connectsphere.core.equipment "Reads reservations for readiness (F5) through" "Function call, same transaction"
        connectsphere.core.change -> connectsphere.core.event "Applies approved changes and confirms events through" "Function call, same transaction"

        # Each module writes only its own schema
        connectsphere.core.identity -> connectsphere.coreDb "Reads and writes the identity schema in" "SQL"
        connectsphere.core.event -> connectsphere.coreDb "Reads and writes the event schema and its outbox in" "SQL"
        connectsphere.core.venue -> connectsphere.coreDb "Reads and writes the venue schema in" "SQL"
        connectsphere.core.equipment -> connectsphere.coreDb "Reads and writes the equipment schema in" "SQL"
        connectsphere.core.change -> connectsphere.coreDb "Reads and writes the change schema in" "SQL"
        connectsphere.registration -> connectsphere.registrationDb "Claims seats and writes registrations in" "SQL"
        connectsphere.notification -> connectsphere.notificationDb "Stores notifications and read state in" "SQL"

        # Authorisation decisions (ADR-0010, EN-07)
        connectsphere.core.identity -> connectsphere.cerbos "Asks for permission decisions" "HTTP, JSON"
        connectsphere.core.event -> connectsphere.cerbos "Asks for permission decisions" "HTTP, JSON"
        connectsphere.core.venue -> connectsphere.cerbos "Asks for permission decisions" "HTTP, JSON"
        connectsphere.core.equipment -> connectsphere.cerbos "Asks for permission decisions" "HTTP, JSON"
        connectsphere.core.change -> connectsphere.cerbos "Asks for permission decisions" "HTTP, JSON"

        # Messaging: publish only through the outbox, consume only through an inbox (ADR-0008)
        connectsphere.core.event -> connectsphere.kafka "Publishes event lifecycle messages (connectsphere.event.v1) to, through its outbox" "Kafka"
        connectsphere.core.venue -> connectsphere.kafka "Publishes hold and booking messages (venue-booking) to, through its outbox" "Kafka"
        connectsphere.core.equipment -> connectsphere.kafka "Publishes request-line and reservation messages to, through its outbox" "Kafka"
        connectsphere.core.change -> connectsphere.kafka "Publishes change and safety messages to, through its outbox" "Kafka"
        connectsphere.registration -> connectsphere.kafka "Publishes registration messages to, and consumes event and venue-booking messages from" "Kafka"
        connectsphere.notification -> connectsphere.kafka "Consumes every notification trigger from, with retry and dead-letter topics" "Kafka"
        connectsphere.workers -> connectsphere.kafka "Consumes event and hold messages from, to start workflows" "Kafka"
        connectsphere.notification -> email "Would send email through (not built)" "SMTP or API"

        # Cross-deployable synchronous calls, never inside a transaction (implementation.md section 11)
        connectsphere.registration -> connectsphere.core.identity "Resolves callers and names attendees (R5 to R7) through" "JSON/HTTPS"
        connectsphere.notification -> connectsphere.core.identity "Resolves callers through" "JSON/HTTPS"
        connectsphere.workers -> connectsphere.temporal "Polls task queues, starts workflows and sets timers in" "gRPC"
        connectsphere.workers -> connectsphere.coreDb "Runs the CompleteEvent and HoldExpiry rules (event and venue modules' functions) in" "SQL"

        # Observability (ADR-0013, EN-08)
        connectsphere.core -> grafana "Exports traces and metrics to (opt-in)" "OTLP, HTTP"
        connectsphere.registration -> grafana "Exports traces and metrics to (opt-in)" "OTLP, HTTP"
        connectsphere.notification -> grafana "Exports traces and metrics to (opt-in)" "OTLP, HTTP"
        connectsphere.workers -> grafana "Exports traces and metrics to (opt-in)" "OTLP, HTTP"

        deploymentEnvironment "Development" {
            deploymentNode "Developer laptop" "" "Windows or macOS, Node.js 20" {
                deploymentNode "Web browser" "" "Chrome, Firefox or Safari" {
                    containerInstance connectsphere.staffConsole
                    containerInstance connectsphere.attendeeApp
                }
                deploymentNode "npm run dev" "One terminal, no Docker (CLAUDE.md). Cerbos is not run: development falls back to the local policies." "concurrently" {
                    infrastructureNode "Vite dev server" "Serves the SPA; proxies the service prefixes to the services" "Vite, :5173"
                    deploymentNode "planning-core process" "" "tsx watch, :8090" {
                        containerInstance connectsphere.core
                    }
                    deploymentNode "registration process" "" "tsx watch" {
                        containerInstance connectsphere.registration
                    }
                    deploymentNode "notification process" "" "tsx watch" {
                        containerInstance connectsphere.notification
                    }
                    deploymentNode "worker process" "Exits quietly when TEMPORAL_ADDRESS is unset" "tsx watch" {
                        containerInstance connectsphere.workers
                    }
                }
            }
            deploymentNode "Supabase (the team's hosted project)" "Shared by developers" "Supabase" {
                deploymentNode "Postgres" "" "Postgres, transaction pooler :6543" {
                    containerInstance connectsphere.coreDb
                    containerInstance connectsphere.registrationDb
                    containerInstance connectsphere.notificationDb
                }
                softwareSystemInstance supabaseAuth
            }
            deploymentNode "Hosted Kafka cluster" "Shared by the team, reached through the KAFKA_* variables" "Managed Kafka" {
                containerInstance connectsphere.kafka
            }
            deploymentNode "Hosted Temporal namespace" "Reached through the TEMPORAL_* variables" "Temporal" {
                containerInstance connectsphere.temporal
            }
        }

        deploymentEnvironment "Staging" {
            deploymentNode "User's device" "" "Browser" {
                containerInstance connectsphere.staffConsole
                containerInstance connectsphere.attendeeApp
            }
            deploymentNode "Vercel (Hobby), project connectsphere-staging" "Serves the SPA built for this environment (VITE_API_BASE_URL, VITE_SUPABASE_*)" "Vercel, static CDN" {
                infrastructureNode "Static SPA bundle" "The same bundle serves the staff console and the attendee app" "vercel build --prebuilt"
            }
            deploymentNode "Azure (Azure for Students), resource group connectsphere-rg" "Region southeastasia; every resource tagged project=connectsphere (ADR-0016, Azure amendment)" "Microsoft Azure" {
                deploymentNode "Virtual machine, shared by staging and production" "Standard_B2pls_v2: 2 vCPU arm64, 4 GB. The network security group admits only TCP 22, 80 and 443. No high availability: if it stops, both environments stop." "Ubuntu 24.04" {
                    infrastructureNode "Host Caddy" "Lets Encrypt certificates; routes api.staging.<ip>.sslip.io to this environment's container. No Kong, no Redis." "Caddy, :80 and :443"
                    deploymentNode "Container connectsphere-staging" "Built on the VM from the committed source; the same image in both environments; 127.0.0.1:7861. Supervisord runs the programs below; migrations run at start." "Docker, arm64" {
                        infrastructureNode "Inner Caddy" "Routes only the public API prefixes; answers /healthz" "Caddy, :7860"
                        deploymentNode "planning-core" "" "Node.js 20" {
                            containerInstance connectsphere.core
                        }
                        deploymentNode "worker" "" "Node.js 20" {
                            containerInstance connectsphere.workers
                        }
                        deploymentNode "registration" "" "Node.js 20" {
                            containerInstance connectsphere.registration
                        }
                        deploymentNode "notification" "" "Node.js 20" {
                            containerInstance connectsphere.notification
                        }
                        deploymentNode "Redpanda" "One broker, 512 MB, SASL/SCRAM over TLS; the disk is the container's" "Redpanda" {
                            containerInstance connectsphere.kafka
                        }
                        deploymentNode "Temporal dev server" "SQLite on the container's disk" "Temporal CLI" {
                            containerInstance connectsphere.temporal
                        }
                        deploymentNode "Cerbos PDP" "CERBOS_URL=http://127.0.0.1:3592; policies/ compiled into the image" "Cerbos" {
                            containerInstance connectsphere.cerbos
                        }
                    }
                }
            }
            deploymentNode "Supabase project, staging" "Its own project, apart from the other environment's: its own Postgres and Auth; the session pooler runs the migrations" "Supabase" {
                deploymentNode "Postgres" "" "Postgres" {
                    containerInstance connectsphere.coreDb
                    containerInstance connectsphere.registrationDb
                    containerInstance connectsphere.notificationDb
                }
                softwareSystemInstance supabaseAuth
            }
        }

        deploymentEnvironment "Production" {
            deploymentNode "User's device" "" "Browser" {
                containerInstance connectsphere.staffConsole
                containerInstance connectsphere.attendeeApp
            }
            deploymentNode "Vercel (Hobby), project connectsphere" "Serves the SPA built for this environment (VITE_API_BASE_URL, VITE_SUPABASE_*)" "Vercel, static CDN" {
                infrastructureNode "Static SPA bundle" "The same bundle serves the staff console and the attendee app" "vercel build --prebuilt"
            }
            deploymentNode "Azure (Azure for Students), resource group connectsphere-rg" "Region southeastasia; every resource tagged project=connectsphere (ADR-0016, Azure amendment)" "Microsoft Azure" {
                deploymentNode "Virtual machine, shared by staging and production" "Standard_B2pls_v2: 2 vCPU arm64, 4 GB. The network security group admits only TCP 22, 80 and 443. No high availability: if it stops, both environments stop." "Ubuntu 24.04" {
                    infrastructureNode "Host Caddy" "Lets Encrypt certificates; routes api.<ip>.sslip.io to this environment's container. No Kong, no Redis." "Caddy, :80 and :443"
                    deploymentNode "Container connectsphere-production" "Built on the VM from the committed source; the same image in both environments; 127.0.0.1:7862. Supervisord runs the programs below; migrations run at start." "Docker, arm64" {
                        infrastructureNode "Inner Caddy" "Routes only the public API prefixes; answers /healthz" "Caddy, :7860"
                        deploymentNode "planning-core" "" "Node.js 20" {
                            containerInstance connectsphere.core
                        }
                        deploymentNode "worker" "" "Node.js 20" {
                            containerInstance connectsphere.workers
                        }
                        deploymentNode "registration" "" "Node.js 20" {
                            containerInstance connectsphere.registration
                        }
                        deploymentNode "notification" "" "Node.js 20" {
                            containerInstance connectsphere.notification
                        }
                        deploymentNode "Redpanda" "One broker, 512 MB, SASL/SCRAM over TLS; the disk is the container's" "Redpanda" {
                            containerInstance connectsphere.kafka
                        }
                        deploymentNode "Temporal dev server" "SQLite on the container's disk" "Temporal CLI" {
                            containerInstance connectsphere.temporal
                        }
                        deploymentNode "Cerbos PDP" "CERBOS_URL=http://127.0.0.1:3592; policies/ compiled into the image" "Cerbos" {
                            containerInstance connectsphere.cerbos
                        }
                    }
                }
            }
            deploymentNode "Supabase project, production" "Its own project, apart from the other environment's: its own Postgres and Auth; the session pooler runs the migrations" "Supabase" {
                deploymentNode "Postgres" "" "Postgres" {
                    containerInstance connectsphere.coreDb
                    containerInstance connectsphere.registrationDb
                    containerInstance connectsphere.notificationDb
                }
                softwareSystemInstance supabaseAuth
            }
        }

        deploymentEnvironment "ContinuousIntegration" {
            deploymentNode "GitHub Actions runner" "Containers are allowed here and nowhere else (ADR-0012)" "ubuntu-latest" {
                deploymentNode "Ephemeral Postgres" "Built from every migration (npm run migrate:all); never the shared database" "Postgres 17" {
                    containerInstance connectsphere.coreDb
                    containerInstance connectsphere.registrationDb
                    containerInstance connectsphere.notificationDb
                }
                deploymentNode "Redpanda" "Integration and chaos jobs" "Redpanda" {
                    containerInstance connectsphere.kafka
                }
                deploymentNode "Cerbos" "Permission policy tests and the integration stack" "Cerbos" {
                    containerInstance connectsphere.cerbos
                }
                deploymentNode "Gateway stack" "gateway.yml: the committed config is parsed, and a rendered one is run against the real services and a fake JWKS server" "Docker" {
                    deploymentNode "Kong" "Not deployed in staging or production" "Kong 3.9" {
                        containerInstance connectsphere.gateway
                    }
                    infrastructureNode "Redis" "Shared per-user and per-address rate-limit counters" "Redis"
                }
            }
        }

        deploymentEnvironment "AwsScaleUp" {
            deploymentNode "Amazon Web Services" "Written as Terraform and Kubernetes manifests in deploy/ (EN-10); never applied, because the team has no AWS account. The scale-up path of ADR-0016." "ap-southeast-1, three availability zones" {
                tags "Planned"
                infrastructureNode "CloudFront and WAF" "Would serve both front ends" "CDN" {
                    tags "Planned"
                }
                deploymentNode "EKS cluster" "Argo CD sync; canary releases by Argo Rollouts (EN-16)" "Kubernetes" {
                    tags "Planned"
                    deploymentNode "Kong" "" "Kubernetes Deployment" {
                        containerInstance connectsphere.gateway
                    }
                    deploymentNode "planning-core pods" "" "Kubernetes Deployment" {
                        containerInstance connectsphere.core
                        containerInstance connectsphere.cerbos
                    }
                    deploymentNode "registration pods" "" "Kubernetes Deployment" {
                        containerInstance connectsphere.registration
                    }
                    deploymentNode "notification pods" "" "Kubernetes Deployment" {
                        containerInstance connectsphere.notification
                    }
                    deploymentNode "workflow worker pods" "" "Kubernetes Deployment" {
                        containerInstance connectsphere.workers
                    }
                }
                infrastructureNode "Redis" "Per-user token buckets (ADR-0011)" "ElastiCache" {
                    tags "Planned"
                }
            }
        }
    }

    views {
        systemContext connectsphere "SystemContext" "Level 1: who uses ConnectSphere and what it depends on." {
            include *
            autoLayout lr
        }

        container connectsphere "Containers" "Level 2: the deployables and data stores. Dashed elements are not serving users: the email sender is not built, and Kong runs in CI only." {
            include *
            autoLayout lr
        }

        component connectsphere.core "PlanningCoreComponents" "Level 3: planning-core's five modules. Arrows between modules are function calls through each module's index.ts; CI fails on anything else (npm run lint:boundaries)." {
            include connectsphere.core.identity connectsphere.core.event connectsphere.core.venue connectsphere.core.equipment connectsphere.core.change
            include connectsphere.coreDb connectsphere.kafka connectsphere.cerbos
            autoLayout lr
        }

        dynamic connectsphere "CancelEvent" "F3/F4: cancelling an event is one planning-core transaction; the other services act on event.cancelled afterwards (ADR-0009 implementation note)." {
            coordinator -> connectsphere.staffConsole "Cancels the event, giving a reason"
            connectsphere.staffConsole -> connectsphere.core "POST /event/api/v1/events/{id}/cancellation"
            connectsphere.core -> connectsphere.coreDb "One transaction: event Cancelled; bookings, holds, requests and reservations Released; outbox row"
            connectsphere.core -> connectsphere.kafka "event.cancelled reaches the log through the outbox"
            connectsphere.registration -> connectsphere.kafka "Consumes event.cancelled"
            connectsphere.registration -> connectsphere.registrationDb "Cancels the event's registrations and waitlist entries, frees the seats, writes registration.cancelled"
            connectsphere.notification -> connectsphere.kafka "Consumes event.cancelled and registration.cancelled"
            connectsphere.notification -> connectsphere.notificationDb "Creates each notification once (inbox check)"
            autoLayout lr
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic connectsphere "Register" "R2: registering when places open. Each seat is a row, so racing attendees lock different rows and capacity can never be exceeded (ADR-0005)." {
            attendee -> connectsphere.attendeeApp "Registers for an event"
            connectsphere.attendeeApp -> connectsphere.registration "POST /registration/api/v1/registrations with an Idempotency-Key (and a waiting-room token for a high-demand event)"
            connectsphere.registration -> connectsphere.registrationDb "Claims one free seat row (FOR UPDATE SKIP LOCKED) and writes the outbox row, in one transaction"
            connectsphere.registration -> connectsphere.kafka "registration.confirmed reaches the log through the outbox"
            connectsphere.notification -> connectsphere.kafka "Consumes registration.confirmed"
            connectsphere.notification -> connectsphere.notificationDb "Creates the notification once (inbox check)"
            autoLayout lr
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic connectsphere "SafetyCheck" "CR-06 (U1): the Operational Safety Check sits between confirmed arrangements and preparation." {
            coordinator -> connectsphere.staffConsole "Confirms the event's arrangements (F5)"
            connectsphere.staffConsole -> connectsphere.core "POST /event/api/v1/events/{id}/confirmation"
            connectsphere.core -> connectsphere.coreDb "One transaction: venue and equipment ready, status Safety Review, outbox row"
            safetyOfficer -> connectsphere.staffConsole "Reviews and decides: approve, request changes, or reject"
            connectsphere.staffConsole -> connectsphere.core "POST the safety decision"
            connectsphere.core -> connectsphere.coreDb "Approve: check passed. Request changes or reject: back to Planning, arrangements flagged. Decision row, history entry and outbox row either way"
            connectsphere.core -> connectsphere.kafka "event.safety-* reaches the log through the outbox"
            connectsphere.notification -> connectsphere.kafka "Consumes it and notifies the coordinator and organiser"
            autoLayout lr
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic connectsphere "HoldExpiry" "CR-04 (L6): a placed hold expires on time even if nobody is using the system. A Temporal timer per hold, started from the venue-booking topic." {
            venueStaff -> connectsphere.staffConsole "Places a requested hold, with an expiry (L3)"
            connectsphere.staffConsole -> connectsphere.core "POST /venue/api/v1/holds/{id}/place"
            connectsphere.core -> connectsphere.coreDb "Inserts the HELD slot (exclusion constraint on the occupied period) and the outbox row"
            connectsphere.core -> connectsphere.kafka "The placed-hold message reaches the log through the outbox"
            connectsphere.workers -> connectsphere.kafka "Consumes it"
            connectsphere.workers -> connectsphere.temporal "Starts a HoldExpiry workflow: a reminder timer, then an expiry timer"
            connectsphere.workers -> connectsphere.coreDb "On wake-up, under the hold's row lock: reminds, or expires the hold if it was not converted or released (slot Expired, period free, outbox row)"
            connectsphere.notification -> connectsphere.kafka "Consumes the reminder and expiry messages and notifies the coordinator"
            autoLayout lr
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        deployment connectsphere "Development" "LocalDevelopment" "What a developer runs: npm run dev on a laptop against the team's hosted Supabase, Kafka and Temporal." {
            include *
            autoLayout lr
        }

        deployment connectsphere "Staging" "StagingDeployment" "Staging: the SPA on Vercel; one Azure VM running the backend in a container with Redpanda, Temporal and Cerbos; its own Supabase project (ADR-0016). Kong is not deployed." {
            include *
            autoLayout lr
        }

        deployment connectsphere "Production" "ProductionDeployment" "Production: the same image and layout as staging, on the same VM, with its own Vercel project and Supabase project. Kong is not deployed." {
            include *
            autoLayout lr
        }

        deployment connectsphere "ContinuousIntegration" "CiDeployment" "What CI runs: an ephemeral Postgres, Redpanda, Cerbos, and the Kong gateway stack, which exists only here." {
            include *
            autoLayout lr
        }

        deployment connectsphere "AwsScaleUp" "AwsScaleUpDeployment" "The scale-up path of ADR-0016: Terraform and manifests exist (EN-10), nothing is provisioned. Dashed because it is not built." {
            include *
            autoLayout lr
        }

        styles {
            element "Element" {
                color #ffffff
            }
            element "Person" {
                shape Person
                background #08427b
            }
            element "Software System" {
                background #1168bd
            }
            element "External" {
                background #8a8a8a
            }
            element "Container" {
                background #438dd5
            }
            element "Component" {
                background #85bbf0
                color #000000
            }
            element "Web" {
                shape WebBrowser
            }
            element "Database" {
                shape Cylinder
            }
            element "Queue" {
                shape Pipe
            }
            element "Infrastructure Node" {
                background #ffffff
                color #000000
            }
            element "Planned" {
                border dashed
                opacity 60
            }
            element "CiOnly" {
                border dotted
                opacity 80
            }
        }
    }
}
