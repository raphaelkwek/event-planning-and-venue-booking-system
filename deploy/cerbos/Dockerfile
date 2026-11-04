# syntax=docker/dockerfile:1.7
# ADR-0016, for EN-07 (ADR-0010). The Cerbos policy decision point with the repository's
# policies/ baked in, so the PDP each namespace runs serves exactly the policies of the
# release it belongs to, by digest, signed like every other image. Built in CI only:
#
#   docker buildx build -f deploy/cerbos/Dockerfile .
#
# Dockerfile.dockerignore (next to this file) limits the context to policies/ and the config.
# The first stage compiles the policies and runs their tests (as `npm run policies:test` does),
# so an image with a broken policy is never built.

ARG CERBOS_IMAGE=ghcr.io/cerbos/cerbos:0.56.0@sha256:540643bc67ba628011a150ad1d3370f285daa38995be5cd7a4be181da902bec1

FROM ${CERBOS_IMAGE} AS check
COPY policies /policies-under-test
RUN ["/cerbos", "compile", "/policies-under-test"]

FROM ${CERBOS_IMAGE} AS runtime
LABEL org.opencontainers.image.source="https://github.com/raphaelkwek/event-planning-and-venue-booking-system" \
      org.opencontainers.image.title="connectsphere-cerbos"
# Only the policies; the tests and their fixtures stay in the first stage.
COPY --from=check /policies-under-test/derived_roles /connectsphere/policies/derived_roles
COPY --from=check /policies-under-test/resources /connectsphere/policies/resources
COPY deploy/cerbos/config.yaml /connectsphere/config.yaml
# The base image runs as root; nothing here needs it.
USER 10001:10001
EXPOSE 3592 3593
ENTRYPOINT ["/cerbos"]
CMD ["server", "--config=/connectsphere/config.yaml"]
