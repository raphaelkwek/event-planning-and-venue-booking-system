FROM node:20-slim AS base
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json* ./
COPY services/identity/package.json services/identity/package.json
RUN npm ci --workspace=@connectsphere/identity-service --include-workspace-root

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY tsconfig.base.json ./
COPY services/identity ./services/identity
RUN npm run build --workspace=@connectsphere/identity-service

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/services/identity/dist ./services/identity/dist
COPY services/identity/package.json ./services/identity/package.json
EXPOSE 8081
CMD ["node", "services/identity/dist/index.js"]
