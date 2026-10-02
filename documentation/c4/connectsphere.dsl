/*
 * ConnectSphere: C4 model (EN-09, SPM-127). Rendered in CI by
 * .github/workflows/diagrams.yml; how to update the images is in README.md.
 *
 * Source of truth for the design is ADR-0004 to ADR-0015 (documentation/adr/)
 * and plan.md §2 to §8. Elements tagged "Planned" are designed but not built
 * yet; their tag names the enabler that builds them. The diagrams draw them
 * dashed so nobody mistakes the target for what runs today.
 */
workspace "ConnectSphere" "Event planning and venue booking for ConnectSphere-managed venues." {

    !identifiers hierarchical

    model {
        organiser = person "Event Organiser" "Requests events and follows them through approval."
        coordinator = person "Event Coordinator" "Reviews requests, plans events, books venues and equipment."
        venueStaff = person "Venue Staff" "Maintains venues and decides booking requests."
        techSupport = person "Technical Support Staff" "Maintains equipment and arranges reservations."
        attendee = person "Attendee" "Browses open events and registers."

        supabaseAuth = softwareSystem "Supabase Auth" "Issues and verifies sign-in tokens (JWT, MFA for staff)." {
            tags "External"
        }
        email = softwareSystem "Email provider" "Delivers notifications by email. A stretch goal behind an adapter." {
            tags "External" "Planned"
        }

        connectsphere = softwareSystem "ConnectSphere" "Manages an event's lifecycle: request, review, venue booking, equipment, registration and change." {

            staffConsole = container "Staff console" "Every internal role's screens: requests, review queue, venues, equipment, change requests." "React 18, Atlaskit, Vite" {
                tags "Web"
            }
            attendeeApp = container "Attendee app" "Browse open events, register, manage my registrations." "React PWA (EN-13)" {
                tags "Web" "Planned"
            }
            gateway = container "API gateway" "Checks JWTs, rate-limits per user, routes, starts the trace. The Vite dev proxy stands in until EN-12." "Kong, Redis rate limits (EN-12)" {
                tags "Planned"
            }

            core = container "planning-core" "The staff-facing deployable. Rules that span modules (F4, F5, S2/S3, G2) are one Postgres transaction (ADR-0004)." "Node.js 20, Express 4, TypeScript" {
                identity = component "Identity module" "Login (A1), roles (A2), access scope (A3). Public interface: lookUpCaller, resolveAccessScope." "modules/identity"
                event = component "Event module" "Requests, drafts, review, clarification, assignment, status lifecycle (B1 to G2). Public interface: findEventForPlanning." "modules/event"
                venue = component "Venue module" "Catalogue, calendar, search, suitability, holds and bookings (H1 to N2). Owns the venue slot exclusion constraint (ADR-0006)." "modules/venue"
                equipment = component "Equipment module" "Requests, availability, reservations (O1 to Q2). Per-unit exclusion constraint, bulk type lock and peak check." "modules/equipment"
                change = component "Change and readiness module" "Confirmation readiness (F5) and change requests with impact flags (S1 to S3)." "modules/change"
            }

            registration = container "registration-service" "Seat inventory, registrations and the waitlist (R1 to R7). Seats are rows claimed with SKIP LOCKED (ADR-0005)." "Node.js, TypeScript (EN-13)" {
                tags "Planned"
            }
            notification = container "notification-service" "Notification records and read state (T2). Consumes events through an inbox, with retries and a DLQ (ADR-0008)." "Node.js, TypeScript (EN-04.3)" {
                tags "Planned"
            }
            workers = container "Workflow workers" "CancelEvent, ReduceCapacity, CompleteEvent, WaitlistInvitation, ChangeImpactNotify (ADR-0009)." "Temporal TypeScript SDK (EN-11)" {
                tags "Planned"
            }
            cerbos = container "Policy decision point" "Answers 'may this role do this action?' from the policy files in the repo (ADR-0010)." "Cerbos (EN-07)" {
                tags "Planned"
            }

            coreDb = container "Core database" "One schema per module: identity, event, venue, equipment, change. Every invariant is a constraint or a row lock (ADR-0006)." "Supabase Postgres 15" {
                tags "Database"
            }
            registrationDb = container "Registration database" "registration schema: seats, registrations, waitlist, inbox, outbox." "Supabase Postgres 15" {
                tags "Database" "Planned"
            }
            notificationDb = container "Notification database" "notification schema: notifications, read state, inbox." "Supabase Postgres 15" {
                tags "Database" "Planned"
            }
            kafka = container "Event log" "Domain events: one topic per aggregate, CloudEvents envelope, schema registry (ADR-0008)." "Hosted Kafka (EN-04)" {
                tags "Queue" "Planned"
            }
            temporal = container "Workflow engine" "Durable workflow state and timers." "Temporal (EN-11)" {
                tags "Planned"
            }
        }

        # People use the two front ends
        organiser -> connectsphere.staffConsole "Requests and tracks events in" "HTTPS"
        coordinator -> connectsphere.staffConsole "Reviews, plans and cancels events in" "HTTPS"
        venueStaff -> connectsphere.staffConsole "Maintains venues and decides bookings in" "HTTPS"
        techSupport -> connectsphere.staffConsole "Maintains equipment and arranges reservations in" "HTTPS"
        attendee -> connectsphere.attendeeApp "Browses and registers in" "HTTPS"

        # Sign-in
        connectsphere.staffConsole -> supabaseAuth "Signs users in with" "HTTPS"
        connectsphere.attendeeApp -> supabaseAuth "Signs attendees in with" "HTTPS"
        connectsphere.core -> supabaseAuth "Checks passwords, revokes sessions and verifies tokens with" "HTTPS, JWKS"

        # Front ends to the backend
        connectsphere.staffConsole -> connectsphere.gateway "Calls the API through" "JSON/HTTPS"
        connectsphere.attendeeApp -> connectsphere.gateway "Calls the API through" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.core.identity "Routes /api/v1/auth, /users and /access-scope to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.core.event "Routes /api/v1/events and /event-drafts to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.core.venue "Routes venue routes to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.core.equipment "Routes equipment routes to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.core.change "Routes change-request routes to" "JSON/HTTPS"
        connectsphere.gateway -> connectsphere.registration "Routes /api/v1/registrations to" "JSON/HTTPS"
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

        # Authorisation decisions (ADR-0010)
        connectsphere.core -> connectsphere.cerbos "Asks for permission decisions" "gRPC"
        connectsphere.registration -> connectsphere.cerbos "Asks for permission decisions" "gRPC"

        # Messaging: publish only through the outbox, consume only through an inbox (ADR-0008)
        connectsphere.core.event -> connectsphere.kafka "Publishes event lifecycle messages to, through its outbox" "Kafka"
        connectsphere.core.venue -> connectsphere.kafka "Publishes booking messages (booking.confirmed) to, through its outbox" "Kafka"
        connectsphere.registration -> connectsphere.kafka "Publishes registration messages to and consumes booking.confirmed from" "Kafka"
        connectsphere.notification -> connectsphere.kafka "Consumes every notification trigger from" "Kafka"
        connectsphere.notification -> email "Sends email through" "SMTP or API"

        # Cross-deployable synchronous calls, never inside a transaction (plan.md §5)
        connectsphere.registration -> connectsphere.core.event "Reads published event information (R1) from" "JSON/HTTPS"
        connectsphere.core.event -> connectsphere.temporal "Starts CancelEvent and CompleteEvent in" "gRPC"
        connectsphere.workers -> connectsphere.temporal "Polls task queues and records progress in" "gRPC"
        connectsphere.workers -> connectsphere.core.event "Runs cancellation and completion activities against" "JSON/HTTPS"
        connectsphere.workers -> connectsphere.registration "Freezes, unfreezes and finalises registrations in" "JSON/HTTPS"

        deploymentEnvironment "Development" {
            deploymentNode "Developer laptop" "" "Windows or macOS, Node.js 20" {
                deploymentNode "Web browser" "" "Chrome, Firefox or Safari" {
                    containerInstance connectsphere.staffConsole
                }
                deploymentNode "npm run dev" "One terminal; no Docker (CLAUDE.md)" "concurrently" {
                    infrastructureNode "Vite dev server" "Serves the staff console; proxies /identity/* and /event/* to planning-core" "Vite, :5173"
                    deploymentNode "planning-core process" "" "tsx watch, :8090" {
                        containerInstance connectsphere.core
                    }
                }
            }
            deploymentNode "Supabase (the team's hosted project)" "" "Supabase" {
                deploymentNode "Postgres" "" "Postgres 15, transaction pooler :6543" {
                    containerInstance connectsphere.coreDb
                }
                softwareSystemInstance supabaseAuth
            }
            deploymentNode "Hosted Kafka cluster" "Shared by the team, reached through the KAFKA_* variables" "Managed Kafka" {
                containerInstance connectsphere.kafka
            }
        }

        deploymentEnvironment "Production" {
            deploymentNode "User's device" "" "Browser or installed PWA" {
                containerInstance connectsphere.staffConsole
                containerInstance connectsphere.attendeeApp
            }
            deploymentNode "Amazon Web Services" "Provisioned by Terraform (EN-10)" "ap-southeast-1, three availability zones" {
                tags "Planned"
                infrastructureNode "CloudFront and WAF" "Serves both front ends; caches the attendee browse list for 5 s" "CDN" {
                    tags "Planned"
                }
                deploymentNode "EKS cluster" "Synced by Argo CD from a config repo; canary releases by Argo Rollouts (EN-16)" "Kubernetes" {
                    tags "Planned"
                    deploymentNode "Kong" "" "Kubernetes Deployment" {
                        containerInstance connectsphere.gateway
                    }
                    deploymentNode "planning-core pods" "" "Kubernetes Deployment, HPA on CPU and RPS" {
                        containerInstance connectsphere.core
                        containerInstance connectsphere.cerbos
                    }
                    deploymentNode "registration pods" "" "Kubernetes Deployment, HPA on RPS" {
                        containerInstance connectsphere.registration
                    }
                    deploymentNode "notification pods" "" "Kubernetes Deployment, KEDA on consumer lag" {
                        containerInstance connectsphere.notification
                    }
                    deploymentNode "workflow worker pods" "" "Kubernetes Deployment, KEDA on task-queue backlog" {
                        containerInstance connectsphere.workers
                    }
                    infrastructureNode "OpenTelemetry collector" "Ships traces, metrics and logs to Grafana Cloud (ADR-0013)" "OTel Collector" {
                        tags "Planned"
                    }
                }
                infrastructureNode "Redis" "Per-user token buckets for rate limiting (ADR-0011)" "ElastiCache" {
                    tags "Planned"
                }
            }
            deploymentNode "Supabase" "" "Managed Postgres, Auth, Storage" {
                deploymentNode "Postgres" "" "Postgres 15" {
                    containerInstance connectsphere.coreDb
                    containerInstance connectsphere.registrationDb
                    containerInstance connectsphere.notificationDb
                }
                softwareSystemInstance supabaseAuth
            }
            deploymentNode "Kafka provider" "" "Managed Kafka, schema registry" {
                tags "Planned"
                containerInstance connectsphere.kafka
            }
            deploymentNode "Temporal Cloud" "" "Managed Temporal" {
                tags "Planned"
                containerInstance connectsphere.temporal
            }
        }
    }

    views {
        systemContext connectsphere "SystemContext" "Level 1: who uses ConnectSphere and what it depends on." {
            include *
            autoLayout lr
        }

        container connectsphere "Containers" "Level 2: the deployables and data stores. Dashed elements are designed but not built yet." {
            include *
            autoLayout lr
        }

        component connectsphere.core "PlanningCoreComponents" "Level 3: planning-core's five modules. Arrows between modules are function calls through each module's index.ts; CI fails on anything else (npm run lint:boundaries)." {
            include connectsphere.core.identity connectsphere.core.event connectsphere.core.venue connectsphere.core.equipment connectsphere.core.change
            include connectsphere.gateway connectsphere.coreDb connectsphere.kafka
            autoLayout lr
        }

        dynamic connectsphere "CancelEvent" "F3/F4: cancelling an event is all or nothing, using a semantic lock instead of a compensating saga (ADR-0009)." {
            coordinator -> connectsphere.staffConsole "Cancels the event, giving a reason"
            connectsphere.staffConsole -> connectsphere.gateway "POST /api/v1/events/{id}/cancellation with an Idempotency-Key"
            connectsphere.gateway -> connectsphere.core "Forwards the request"
            connectsphere.core -> connectsphere.temporal "Starts the CancelEvent workflow"
            connectsphere.workers -> connectsphere.temporal "Picks up CancelEvent"
            connectsphere.workers -> connectsphere.registration "Freeze: mark registrations CANCEL_PENDING (they still count)"
            connectsphere.workers -> connectsphere.core "Commit: cancel the event and release its slot and reservations"
            connectsphere.core -> connectsphere.coreDb "One transaction: event Cancelled, slot and reservations Released, outbox row"
            connectsphere.workers -> connectsphere.registration "Finalise: mark registrations Cancelled (retried until done)"
            autoLayout lr
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        dynamic connectsphere "Register" "R2: registering when places open. Each seat is a row, so racing attendees lock different rows and capacity can never be exceeded (ADR-0005)." {
            attendee -> connectsphere.attendeeApp "Registers for an event"
            connectsphere.attendeeApp -> connectsphere.gateway "POST /api/v1/registrations with a waiting-room token and an Idempotency-Key"
            connectsphere.gateway -> connectsphere.registration "Forwards, rate-limited per user"
            connectsphere.registration -> connectsphere.registrationDb "Claims one free seat row (FOR UPDATE SKIP LOCKED) and writes the outbox row, in one transaction"
            connectsphere.registration -> connectsphere.kafka "registration.created reaches the log through the outbox"
            connectsphere.notification -> connectsphere.kafka "Consumes registration.created"
            connectsphere.notification -> connectsphere.notificationDb "Creates the notification once (inbox check)"
            autoLayout lr
            properties {
                "plantuml.sequenceDiagram" "true"
            }
        }

        deployment connectsphere "Development" "LocalDevelopment" "What runs today: npm run dev on a laptop against the team's hosted Supabase and Kafka." {
            include *
            autoLayout lr
        }

        deployment connectsphere "Production" "ProductionDeployment" "The target deployment (ADR-0012, Tier 2). Dashed elements are not provisioned yet." {
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
        }
    }
}
