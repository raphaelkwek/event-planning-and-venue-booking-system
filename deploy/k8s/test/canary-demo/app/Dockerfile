# CI only: the canary demonstration's stand-in service (see server.js).
FROM node:20.20.2-alpine3.23@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293
WORKDIR /app
COPY server.js .
USER 1000:1000
EXPOSE 8080
CMD ["node", "server.js"]
