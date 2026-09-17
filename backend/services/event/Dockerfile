FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY backend/services/event/package.json backend/services/event/package.json
COPY backend/packages/contracts/package.json backend/packages/contracts/package.json
RUN npm ci --workspace=@connectsphere/event-service --include-workspace-root

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY backend/tsconfig.base.json ./backend/
COPY backend/packages/contracts ./backend/packages/contracts
COPY backend/services/event ./backend/services/event
RUN npm run build --workspace=@connectsphere/event-service

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/backend/services/event/dist ./backend/services/event/dist
COPY --from=build /app/backend/packages/contracts ./backend/packages/contracts
COPY backend/services/event/package.json ./backend/services/event/package.json
EXPOSE 8082
CMD ["node", "backend/services/event/dist/index.js"]
