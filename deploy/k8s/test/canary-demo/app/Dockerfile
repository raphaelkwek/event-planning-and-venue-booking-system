# CI only: the canary demonstration's stand-in service (see server.js).
FROM node:20.18.1-alpine3.21@sha256:24fb6aa7020d9a20b00d6da6d1714187c45ed00d1eb4adb01395843c338b9372
WORKDIR /app
COPY server.js .
USER 1000:1000
EXPOSE 8080
CMD ["node", "server.js"]
