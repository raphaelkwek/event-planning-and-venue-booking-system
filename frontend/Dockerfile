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

ARG NODE_IMAGE=node:20.20.2-alpine3.23@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
ARG NGINX_IMAGE=nginxinc/nginx-unprivileged:1.31.7-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e

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
# EN-21 (Trivy): security fixes published since the pinned base image was built. The base image
# runs as uid 101, so switch to root for this one layer; `USER 101` below puts it back.
USER root
RUN apk upgrade --no-cache
LABEL org.opencontainers.image.source="https://github.com/raphaelkwek/event-planning-and-venue-booking-system"       org.opencontainers.image.title="connectsphere-web"
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY frontend/security-headers.inc /etc/nginx/conf.d/security-headers.inc
COPY --from=build /app/frontend/dist /usr/share/nginx/html
# nginx-unprivileged already runs as uid 101 and listens on 8080.
USER 101
EXPOSE 8080
