#!/bin/sh
# Backend entrypoint: wait for Postgres/Redis, push schema, then start API.
# Fixes two local docker failure modes:
#  1. Old CMD used `... && node` so any prisma/seed failure prevented node from starting.
#  2. Bridge networking can resolve `postgres` but refuse TCP (P1001).
#     We retry both `postgres` and `host.docker.internal` (via host port mapping).
set -u

resolve_db_host() {
  # $DATABASE_URL like postgresql://user:pass@HOST:5432/db?schema=public
  echo "$DATABASE_URL" | sed -E 's|.*@([^:/?]+).*|\1|'
}

DB_HOST=$(resolve_db_host)
echo "[entrypoint] DATABASE_URL host=$DB_HOST"
echo "[entrypoint] REDIS_URL=$REDIS_URL"

# If short hostname fails but host-gateway works, auto-fallback.
# Requires `extra_hosts: ["host.docker.internal:host-gateway"]` (already in compose).
try_host() {
  # $1 = host, $2 = port
  node -e "const s=require('net').connect({host:'$1',port:$2,timeout:2000},()=>{process.exit(0)});s.on('error',()=>process.exit(1));s.on('timeout',()=>process.exit(1));setTimeout(()=>process.exit(1),2500).unref();"
}

if ! try_host "$DB_HOST" 5432; then
  echo "[entrypoint] cannot reach $DB_HOST:5432, trying host.docker.internal:5432..."
  if try_host "host.docker.internal" 5432; then
    echo "[entrypoint] host.docker.internal works — switching DATABASE_URL/REDIS_URL to host gateway"
    export DATABASE_URL=$(echo "$DATABASE_URL" | sed "s/@${DB_HOST}:/@host.docker.internal:/" | sed "s/@${DB_HOST}\//\@host.docker.internal\//")
    export REDIS_URL=$(echo "$REDIS_URL" | sed 's/@[^:]*:/@host.docker.internal:/;s|://[^:/]*:|://host.docker.internal:|;s|://redis|://host.docker.internal|')
    # handle redis://redis:6379 (no @)
    case "$REDIS_URL" in
      redis://redis*) export REDIS_URL="redis://host.docker.internal:6379" ;;
    esac
    echo "[entrypoint] now DATABASE_URL host=$(resolve_db_host) REDIS_URL=$REDIS_URL"
  else
    echo "[entrypoint] neither $DB_HOST nor host.docker.internal reachable yet — will retry via prisma"
  fi
fi

if [ "${DB_AUTO_PUSH:-true}" = "true" ]; then
  echo "[entrypoint] pushing prisma schema (30 retries)..."
  for i in $(seq 1 30); do
    if npx prisma db push --accept-data-loss --schema prisma/schema.prisma; then
      echo "[entrypoint] schema ready"
      break
    fi
    echo "[entrypoint] db push failed attempt $i/30, retry in 2s..."
    sleep 2
    if [ "$i" -eq 30 ]; then
      echo "[entrypoint] DB never became ready — starting API anyway so logs are visible"
    fi
  done
fi

if [ "${DB_SEED_ON_START:-false}" = "true" ]; then
  npx tsx prisma/seed.ts || echo "[entrypoint] seed failed, continuing..."
fi

echo "[entrypoint] starting node dist/index.js"
exec node dist/index.js
