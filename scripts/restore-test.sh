#!/usr/bin/env bash
# Restore drill (PLAN §7): restores a pg_dump into a throwaway Postgres container and checks the
# data came back. Never touches the real database. Run it monthly on the VPS, or anywhere with Docker.
# Usage: scripts/restore-test.sh [dump file]   (default: the newest in $BACKUP_DIR/daily)
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/opt/molingo/backups}"
DUMP="${1:-$(ls -1t "$BACKUP_DIR"/daily/pg-*.dump 2>/dev/null | head -n 1)}"
[ -f "$DUMP" ] || { echo "no dump found (pass one as the first argument)" >&2; exit 1; }

NAME="restore-drill-$$"
trap 'docker rm -f "$NAME" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=drill -e POSTGRES_USER=molingo -e POSTGRES_DB=drill \
  postgres:17-alpine >/dev/null
for _ in $(seq 30); do docker exec "$NAME" pg_isready -U molingo -d drill >/dev/null 2>&1 && break; sleep 1; done
docker exec "$NAME" pg_isready -U molingo -d drill >/dev/null || { echo "scratch database did not start" >&2; exit 1; }

docker cp "$DUMP" "$NAME:/tmp/restore.dump"
docker exec "$NAME" pg_restore -U molingo -d drill --no-owner --exit-on-error /tmp/restore.dump

q() { docker exec "$NAME" psql -U molingo -d drill -Atc "$1"; }
tables="$(q "select count(*) from information_schema.tables where table_schema='public'")"
users="$(q "select count(*) from users")"
[ "$tables" -gt 0 ] || { echo "restore FAILED: no tables" >&2; exit 1; }
[ "$users" -gt 0 ] || { echo "restore FAILED: users table is empty" >&2; exit 1; }
echo "restore OK: $(basename "$DUMP") -> $tables tables, $users users"
