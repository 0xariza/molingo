#!/usr/bin/env bash
# Nightly backup, run on the VPS from /opt/molingo (host cron, see infra/README.md):
#   pg_dump -Fc of the database + a tarball of the uploads volume -> $BACKUP_DIR (14 daily, 8 weekly).
# If RESTIC_REPOSITORY (and RESTIC_PASSWORD) are set in .env, the folder is also snapshotted with
# restic to that repository (PLAN §7: a domestic target). Without them only the local copy is made.
set -euo pipefail
cd "$(dirname "$0")"

BACKUP_DIR="${BACKUP_DIR:-$PWD/backups}"
DAILY=14
WEEKLY=8
STAMP="$(date +%F)"
umask 077
mkdir -p "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"
set -a; [ -f .env ] && . ./.env; set +a

# Write to a .part file first so a failed run never leaves a truncated "latest" backup.
docker compose exec -T db pg_dump -U molingo -Fc molingo >"$BACKUP_DIR/daily/pg-$STAMP.dump.part"
docker compose exec -T app tar -czf - -C /data uploads >"$BACKUP_DIR/daily/uploads-$STAMP.tar.gz.part"
for kind in pg-$STAMP.dump uploads-$STAMP.tar.gz; do
  mv "$BACKUP_DIR/daily/$kind.part" "$BACKUP_DIR/daily/$kind"
  # Sunday's backup is also kept as the weekly one.
  [ "$(date +%u)" = 7 ] && cp "$BACKUP_DIR/daily/$kind" "$BACKUP_DIR/weekly/$kind"
done

prune() { ls -1t "$1"/pg-* 2>/dev/null | tail -n +$(($2 + 1)) | xargs -r rm -f --;
          ls -1t "$1"/uploads-* 2>/dev/null | tail -n +$(($2 + 1)) | xargs -r rm -f --; }
prune "$BACKUP_DIR/daily" "$DAILY"
prune "$BACKUP_DIR/weekly" "$WEEKLY"

if [ -n "${RESTIC_REPOSITORY:-}" ] && command -v restic >/dev/null; then
  restic backup --quiet "$BACKUP_DIR"
  restic forget --quiet --prune --keep-daily "$DAILY" --keep-weekly "$WEEKLY"
else
  echo "restic not configured: local backup only" >&2
fi
echo "backup $STAMP ok: $(du -sh "$BACKUP_DIR" | cut -f1)"
