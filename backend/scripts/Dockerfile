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

ARG NODE_IMAGE=node:20.20.2-alpine3.23@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

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
# EN-21 (Trivy): security fixes published since the pinned base image was built. The Job runs
# `npm run migrate`, so npm stays, but at a pinned release whose bundled tar, glob and minimatch
# are current; the copy that ships with Node 20 carries findings of its own. yarn is not used.
RUN apk upgrade --no-cache \
 && npm install -g npm@11.21.1 --no-audit --no-fund \
 && rm -rf /root/.npm /opt/yarn-* /usr/local/bin/yarn /usr/local/bin/yarnpkg
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
