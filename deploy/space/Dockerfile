# ADR-0016 amendment (Hugging Face Spaces): the whole backend of one environment in one container,
# for a free CPU Basic Docker Space (2 vCPU, 16 GB, no card). deploy-space.mjs copies this file to
# the root of the Space repository, next to the source it needs, and Hugging Face builds it there.
# CI builds the same context (deploy.yml, job "Space image").
#
# Inside: planning-core, its Temporal worker, registration and notification; Redpanda (SASL/SCRAM
# over TLS), the Temporal dev server and the Cerbos PDP; Caddy on 7860, the Space's one public port,
# routing the same public prefixes as the k3s Ingress. supervisord keeps them running; start.sh runs
# the migrations first. Supabase holds the data (the outbox relay republishes anything not yet
# published). Redpanda starts empty after a restart. Temporal keeps its SQLite file in
# /var/lib/connectsphere/temporal, which the Azure VM mounts as a named volume per environment, so
# its workflows and timers survive a redeploy there; a Space has no volume, so there they don't, and
# the worker re-creates the timers when it starts and the sweeps (sweeps.sh) catch up regardless.

ARG NODE_IMAGE=node:20.20.2-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0

FROM ghcr.io/cerbos/cerbos:0.56.0@sha256:540643bc67ba628011a150ad1d3370f285daa38995be5cd7a4be181da902bec1 AS cerbos
FROM docker.io/temporalio/temporal:1.10.0@sha256:003508da05989e7cf0d583cfce521c4bb2732e733574e3040db8f1284783baa2 AS temporal
FROM docker.io/redpandadata/redpanda:v26.2.6@sha256:8b1076e0d61bfceb66594dc01536427ce0b529f8ead35fdab9763ab6085891ce AS redpanda
FROM docker.io/library/caddy:2.10.2@sha256:c3d7ee5d2b11f9dc54f947f68a734c84e9c9666c92c88a7f30b9cba5da182adb AS caddy

FROM ${NODE_IMAGE}
RUN apt-get update \
 && apt-get install -y --no-install-recommends supervisor openssl curl ca-certificates \
 && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/*
COPY --from=cerbos /cerbos /usr/local/bin/cerbos
COPY --from=temporal /usr/local/bin/temporal /usr/local/bin/temporal
COPY --from=redpanda /opt/redpanda /opt/redpanda
COPY --from=caddy /usr/bin/caddy /usr/local/bin/caddy

WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend backend
RUN npm ci --ignore-scripts --no-audit --no-fund --include-workspace-root \
      -w @connectsphere/contracts -w @connectsphere/kafka -w @connectsphere/observability -w @connectsphere/telemetry \
      -w @connectsphere/planning-core -w @connectsphere/registration -w @connectsphere/notification \
 && npm run build -w @connectsphere/contracts -w @connectsphere/kafka -w @connectsphere/observability -w @connectsphere/telemetry \
      -w @connectsphere/planning-core -w @connectsphere/registration -w @connectsphere/notification \
 && for p in contracts kafka observability telemetry; do \
      node -e 'const fs=require("fs"),f=process.argv[1],j=JSON.parse(fs.readFileSync(f));j.main="dist/index.js";fs.writeFileSync(f,JSON.stringify(j,null,2))' "backend/packages/$p/package.json"; \
    done \
 && npx --no-install esbuild backend/scripts/migrate.ts --bundle --platform=node --format=esm --target=node20 \
      --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" \
      --outfile=/app/migrate.mjs \
 && rm -rf /root/.npm

# The PDP serves the repository's policies; the build fails if they do not compile or a test fails.
COPY policies /connectsphere/policies-under-test
RUN cerbos compile /connectsphere/policies-under-test \
 && mkdir -p /connectsphere/policies \
 && cp -r /connectsphere/policies-under-test/derived_roles /connectsphere/policies-under-test/resources /connectsphere/policies/ \
 && rm -rf /connectsphere/policies-under-test
COPY deploy/cerbos/config.yaml /connectsphere/config.yaml
COPY deploy/space /app/deploy/space
# Temporal's state, for uid 1000: an empty named volume mounted here takes this owner when Docker
# first fills it from the image, so the deploy gate's volume is writable without a chown.
RUN install -d -o 1000 -g 1000 -m 0750 /var/lib/connectsphere/temporal

ENV NODE_ENV=production HOME=/home/node
# Hugging Face runs the container as uid 1000, which the node image's `node` user is.
USER 1000
EXPOSE 7860
CMD ["bash", "/app/deploy/space/start.sh"]
