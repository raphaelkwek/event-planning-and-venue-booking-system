FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY backend/services/identity/package.json backend/services/identity/package.json
RUN npm ci --workspace=@connectsphere/identity-service --include-workspace-root

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY backend/tsconfig.base.json ./backend/
COPY backend/services/identity ./backend/services/identity
RUN npm run build --workspace=@connectsphere/identity-service

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/backend/services/identity/dist ./backend/services/identity/dist
COPY backend/services/identity/package.json ./backend/services/identity/package.json
EXPOSE 8081
CMD ["node", "backend/services/identity/dist/index.js"]
