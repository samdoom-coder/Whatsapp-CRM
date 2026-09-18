# syntax=docker/dockerfile:1
# Multi-stage build for the frontend (Vite build → nginx).
# Build context must be the repository root (monorepo workspaces).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/frontend/package.json apps/frontend/package.json
COPY apps/backend/package.json apps/backend/package.json
RUN npm install --workspaces --include-workspace-root
COPY apps/frontend apps/frontend
RUN npm run build -w @wa-crm/frontend

FROM nginx:1.27-alpine
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/apps/frontend/dist /usr/share/nginx/html
EXPOSE 80