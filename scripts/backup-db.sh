#!/bin/sh
# Dump postgres to a timestamped SQL file. Run from repo root.
# Usage: ./scripts/backup-db.sh [output-file]
set -u
OUT="${1:-backup-$(date +%F-%H%M).sql}"
docker compose exec -T postgres pg_dump -U crm whatsapp_crm > "$OUT"
echo "Saved to $OUT"
