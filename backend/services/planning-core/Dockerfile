# syntax=docker/dockerfile:1.7
# EN-10 (ADR-0012). Built in CI only; nobody builds this on a laptop.
#
# Build context: the repository root, because the npm workspaces need the root
# package.json and package-lock.json.
#   docker buildx build -f backend/services/planning-core/Dockerfile .
#
# Why the shared packages are compiled and their `main` repointed:
# @connectsphere/contracts and @connectsphere/kafka export TypeScript source
# ("main": "src/index.ts"). That works under tsx and vitest but not under plain
# `node`. The build stage compiles them and points `main` at dist/ inside this
# image only; the repository's package.json files are untouched.

ARG NODE_IMAGE=node:20.20.2-bookworm-slim@sha256:2cf067cfed83d5ea958367df9f966191a942351a2df77d6f0193e162b5febfc0

# The workspace manifests alone, so the dependency layers are reused until the
# lockfile changes.
FROM ${NODE_IMAGE} AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/packages/contracts/package.json backend/packages/contracts/
COPY backend/packages/kafka/package.json backend/packages/kafka/
COPY backend/services/planning-core/package.json backend/services/planning-core/
COPY backend/services/registration/package.json backend/services/registration/
COPY backend/services/notification/package.json backend/services/notification/

# Compile.
FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund \
      -w @connectsphere/planning-core -w @connectsphere/contracts -w @connectsphere/kafka
COPY backend/tsconfig.base.json backend/
COPY backend/packages/contracts/tsconfig.json backend/packages/contracts/
COPY backend/packages/contracts/src backend/packages/contracts/src
COPY backend/packages/kafka/tsconfig.json backend/packages/kafka/
COPY backend/packages/kafka/src backend/packages/kafka/src
COPY backend/services/planning-core/tsconfig.json backend/services/planning-core/
COPY backend/services/planning-core/src backend/services/planning-core/src
RUN npm run build -w @connectsphere/contracts -w @connectsphere/kafka -w @connectsphere/planning-core \
 && for p in contracts kafka; do \
      node -e 'const fs=require("fs"),f=process.argv[1],j=JSON.parse(fs.readFileSync(f));j.main="dist/index.js";fs.writeFileSync(f,JSON.stringify(j,null,2))' "backend/packages/$p/package.json"; \
    done

# Production dependencies only.
FROM manifests AS deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @connectsphere/planning-core

# What runs.
FROM ${NODE_IMAGE} AS runtime
LABEL org.opencontainers.image.source="https://github.com/raphaelkwek/event-planning-and-venue-booking-system" \
      org.opencontainers.image.title="connectsphere-planning-core"
# EN-21 (Trivy): security fixes published since the pinned base image was built, and no npm, npx,
# corepack or yarn: this image runs `node dist/index.js`, and the copies bundled with the base
# image carry their own findings (tar, glob, minimatch ...) for tools nothing here calls.
RUN apt-get update && apt-get upgrade -y --no-install-recommends \
 && rm -rf /var/lib/apt/lists/* \
 && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/backend/packages/contracts/package.json backend/packages/contracts/package.json
COPY --from=build /app/backend/packages/contracts/dist backend/packages/contracts/dist
COPY --from=build /app/backend/packages/kafka/package.json backend/packages/kafka/package.json
COPY --from=build /app/backend/packages/kafka/dist backend/packages/kafka/dist
COPY --from=build /app/backend/services/planning-core/package.json backend/services/planning-core/package.json
COPY --from=build /app/backend/services/planning-core/dist backend/services/planning-core/dist
# A numeric user, so Kubernetes can verify runAsNonRoot. Uid 1000 is the base
# image's own `node` user.
USER 1000:1000
WORKDIR /app/backend/services/planning-core
EXPOSE 8090
CMD ["node", "dist/index.js"]
# One image, two commands: this API, and the Temporal worker
# (`node dist/temporal/worker.js`, see deploy/k8s/base/planning-core-worker.yaml).
# Debian slim rather than Alpine: Temporal's native core is built for glibc.
