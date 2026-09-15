FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY services/event/package.json services/event/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --workspace=@connectsphere/event-service --include-workspace-root

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY packages/contracts ./packages/contracts
COPY services/event ./services/event
RUN npm run build --workspace=@connectsphere/event-service

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/services/event/dist ./services/event/dist
COPY --from=build /app/packages/contracts ./packages/contracts
COPY services/event/package.json ./services/event/package.json
EXPOSE 8082
CMD ["node", "services/event/dist/index.js"]
