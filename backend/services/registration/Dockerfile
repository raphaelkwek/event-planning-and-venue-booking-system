# syntax=docker/dockerfile:1.7
# EN-10 (ADR-0012). Built in CI only; nobody builds this on a laptop.
#
# Build context: the repository root, because the npm workspaces need the root
# package.json and package-lock.json.
#   docker buildx build -f backend/services/registration/Dockerfile .
#
# Why the shared packages are compiled and their `main` repointed:
# @connectsphere/contracts, @connectsphere/kafka, @connectsphere/observability and
# @connectsphere/telemetry export TypeScript source
# ("main": "src/index.ts"). That works under tsx and vitest but not under plain
# `node`. The build stage compiles them and points `main` at dist/ inside this
# image only; the repository's package.json files are untouched.

ARG NODE_IMAGE=node:20.18.1-alpine3.21@sha256:24fb6aa7020d9a20b00d6da6d1714187c45ed00d1eb4adb01395843c338b9372

# The workspace manifests alone, so the dependency layers are reused until the
# lockfile changes.
FROM ${NODE_IMAGE} AS manifests
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/packages/contracts/package.json backend/packages/contracts/
COPY backend/packages/kafka/package.json backend/packages/kafka/
COPY backend/packages/observability/package.json backend/packages/observability/
COPY backend/packages/telemetry/package.json backend/packages/telemetry/
COPY backend/services/planning-core/package.json backend/services/planning-core/
COPY backend/services/registration/package.json backend/services/registration/
COPY backend/services/notification/package.json backend/services/notification/

# Compile.
FROM manifests AS build
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund \
      -w @connectsphere/registration -w @connectsphere/contracts -w @connectsphere/kafka \
      -w @connectsphere/observability -w @connectsphere/telemetry
COPY backend/tsconfig.base.json backend/
COPY backend/packages/contracts/tsconfig.json backend/packages/contracts/
COPY backend/packages/contracts/src backend/packages/contracts/src
COPY backend/packages/kafka/tsconfig.json backend/packages/kafka/
COPY backend/packages/kafka/src backend/packages/kafka/src
COPY backend/packages/observability/tsconfig.json backend/packages/observability/
COPY backend/packages/telemetry/tsconfig.json backend/packages/telemetry/
COPY backend/packages/observability/src backend/packages/observability/src
COPY backend/packages/telemetry/src backend/packages/telemetry/src
COPY backend/services/registration/tsconfig.json backend/services/registration/
COPY backend/services/registration/src backend/services/registration/src
RUN npm run build -w @connectsphere/contracts -w @connectsphere/kafka -w @connectsphere/observability -w @connectsphere/telemetry \
      -w @connectsphere/registration \
 && for p in contracts kafka observability telemetry; do \
      node -e 'const fs=require("fs"),f=process.argv[1],j=JSON.parse(fs.readFileSync(f));j.main="dist/index.js";fs.writeFileSync(f,JSON.stringify(j,null,2))' "backend/packages/$p/package.json"; \
    done

# Production dependencies only.
FROM manifests AS deps
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts --no-audit --no-fund -w @connectsphere/registration

# What runs.
FROM ${NODE_IMAGE} AS runtime
LABEL org.opencontainers.image.source="https://github.com/raphaelkwek/event-planning-and-venue-booking-system" \
      org.opencontainers.image.title="connectsphere-registration"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps /app/node_modules node_modules
COPY --from=build /app/backend/packages/contracts/package.json backend/packages/contracts/package.json
COPY --from=build /app/backend/packages/contracts/dist backend/packages/contracts/dist
COPY --from=build /app/backend/packages/kafka/package.json backend/packages/kafka/package.json
COPY --from=build /app/backend/packages/kafka/dist backend/packages/kafka/dist
COPY --from=build /app/backend/packages/observability/package.json backend/packages/observability/package.json
COPY --from=build /app/backend/packages/telemetry/package.json backend/packages/telemetry/package.json
COPY --from=build /app/backend/packages/observability/dist backend/packages/observability/dist
COPY --from=build /app/backend/packages/telemetry/dist backend/packages/telemetry/dist
COPY --from=build /app/backend/services/registration/package.json backend/services/registration/package.json
COPY --from=build /app/backend/services/registration/dist backend/services/registration/dist
# A numeric user, so Kubernetes can verify runAsNonRoot. Uid 1000 is the base
# image's own `node` user.
USER 1000:1000
WORKDIR /app/backend/services/registration
EXPOSE 8092
CMD ["node", "dist/index.js"]
