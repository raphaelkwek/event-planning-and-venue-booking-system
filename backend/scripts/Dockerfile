# syntax=docker/dockerfile:1.7
# EN-10 (ADR-0012). The migration image: runs `npm run migrate -- all` against
# the database as a Kubernetes Job before each release (deploy/k8s/base/migrate-job.yaml).
# Built in CI only.
#
# backend/scripts/migrate.ts is TypeScript and the repo runs it with tsx. Here
# esbuild bundles it, with postgres and dotenv, into one file, so the runtime
# image needs no node_modules, no tsx and no registry access. The image's own
# package.json defines `migrate` as `node migrate.mjs`, which is how
# `npm run migrate` keeps working inside the container.
#
#   docker buildx build -f backend/scripts/Dockerfile .

ARG NODE_IMAGE=node:20.18.1-alpine3.21@sha256:24fb6aa7020d9a20b00d6da6d1714187c45ed00d1eb4adb01395843c338b9372

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/packages/contracts/package.json backend/packages/contracts/
COPY backend/packages/kafka/package.json backend/packages/kafka/
COPY backend/services/planning-core/package.json backend/services/planning-core/
COPY backend/services/registration/package.json backend/services/registration/
COPY backend/services/notification/package.json backend/services/notification/
RUN --mount=type=cache,target=/root/.npm     npm ci --ignore-scripts --no-audit --no-fund --workspaces=false
COPY backend/scripts/migrate.ts backend/scripts/migrate.ts
RUN npx --no-install esbuild backend/scripts/migrate.ts --bundle --platform=node --format=esm       --target=node20 --banner:js="import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);"       --outfile=/out/migrate.mjs

FROM ${NODE_IMAGE} AS runtime
LABEL org.opencontainers.image.source="https://github.com/raphaelkwek/event-planning-and-venue-booking-system"       org.opencontainers.image.title="connectsphere-migrate"
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/migrate.mjs migrate.mjs
RUN echo '{"name":"connectsphere-migrate","private":true,"type":"module","scripts":{"migrate":"node migrate.mjs"}}' > package.json
# migrate.ts finds each module's SQL under backend/services/<service>/migrations
# (relative to the working directory).
COPY backend/services/planning-core/migrations backend/services/planning-core/migrations
COPY backend/services/notification/migrations backend/services/notification/migrations
COPY backend/services/registration/migrations backend/services/registration/migrations
USER 1000:1000
CMD ["npm", "run", "migrate", "--", "all"]
