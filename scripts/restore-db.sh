#!/bin/sh
# Restore a pg_dump file into postgres. Run from repo root.
# Usage: ./scripts/restore-db.sh <backup.sql>
# WARNING: overwrites current database content.
set -u
if [ $# -ne 1 ]; then
  echo "Usage: $0 <backup.sql>" >&2
  exit 1
fi
cat "$1" | docker compose exec -T postgres psql -U crm whatsapp_crm
echo "Restored from $1"
