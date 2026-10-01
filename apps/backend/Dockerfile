# syntax=docker/dockerfile:1
# Multi-stage build for the backend (Express + Prisma).
# Build context must be the repository root (monorepo workspaces).

FROM node:20-alpine AS base
RUN apk add --no-cache openssl
WORKDIR /app

# ---- deps: install all workspace dependencies ----
FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/frontend/package.json apps/frontend/package.json
RUN npm install --workspaces --include-workspace-root --no-audit --no-fund

# ---- build: generate Prisma client + compile TS ----
FROM deps AS build
COPY apps/backend apps/backend
RUN npx prisma generate --schema apps/backend/prisma/schema.prisma
RUN npm run build -w @wa-crm/backend

# ---- runtime ----
FROM base AS runtime
ENV NODE_ENV=production
# npm workspaces hoist all deps to the root node_modules (apps/backend/node_modules
# does NOT exist). Copy them from the build stage so the generated Prisma client
# (node_modules/.prisma/client) is included.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/dist ./apps/backend/dist
COPY --from=build /app/apps/backend/prisma ./apps/backend/prisma
COPY apps/backend/package.json apps/backend/package.json
COPY apps/backend/docker-entrypoint.sh apps/backend/docker-entrypoint.sh
RUN chmod +x apps/backend/docker-entrypoint.sh
WORKDIR /app/apps/backend
EXPOSE 4000

# DB_AUTO_PUSH=true creates the schema on boot (used by docker-compose).
# DB_SEED_ON_START=true reseeds demo data (off by default; use `docker compose exec` instead).
# Entrypoint retries `prisma db push` 30x and auto-falls back to
# host.docker.internal when bridge postgres:5432 is blocked.
CMD ["./docker-entrypoint.sh"]