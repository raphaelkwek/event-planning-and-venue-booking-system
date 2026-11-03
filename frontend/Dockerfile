# syntax=docker/dockerfile:1.7
# EN-10 (ADR-0012). The web app: Vite builds static files, an unprivileged
# nginx serves them with a single-page-app fallback. Built in CI only.
#
#   docker buildx build -f frontend/Dockerfile .
#
# Nothing secret is baked in. The two Supabase values below are public by design
# (the browser needs them to sign in) and are passed as build arguments by the
# release pipeline; they default to empty. API calls use relative paths
# (/identity, /event, ...) that the Ingress routes to the services, so no
# service address is compiled in either.

ARG NODE_IMAGE=node:20.18.1-alpine3.21@sha256:24fb6aa7020d9a20b00d6da6d1714187c45ed00d1eb4adb01395843c338b9372
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.27.3-alpine@sha256:9e7238f579a54582263a960d1b0094b4a3ecce641342eda3f8e2ff82b1703d2b

FROM ${NODE_IMAGE} AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/packages/contracts/package.json backend/packages/contracts/
COPY backend/packages/kafka/package.json backend/packages/kafka/
COPY backend/services/planning-core/package.json backend/services/planning-core/
COPY backend/services/registration/package.json backend/services/registration/
COPY backend/services/notification/package.json backend/services/notification/
RUN --mount=type=cache,target=/root/.npm     npm ci --ignore-scripts --no-audit --no-fund -w @connectsphere/web -w @connectsphere/contracts
# The web app imports @connectsphere/contracts (G2), which exports TypeScript source that Vite bundles.
COPY backend/tsconfig.base.json backend/
COPY backend/packages/contracts/tsconfig.json backend/packages/contracts/
COPY backend/packages/contracts/src backend/packages/contracts/src
COPY frontend frontend
ARG SUPABASE_URL=""
ARG SUPABASE_ANON_KEY=""
ENV SUPABASE_URL=${SUPABASE_URL} SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
RUN npm run build -w @connectsphere/web

FROM ${NGINX_IMAGE} AS runtime
LABEL org.opencontainers.image.source="https://github.com/raphaelkwek/event-planning-and-venue-booking-system"       org.opencontainers.image.title="connectsphere-web"
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY --from=build /app/frontend/dist /usr/share/nginx/html
# nginx-unprivileged already runs as uid 101 and listens on 8080.
USER 101
EXPOSE 8080
