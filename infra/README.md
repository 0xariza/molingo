# Production infrastructure

The VPS stack (PLAN.md §7): Caddy with the layer4 plugin, LiveKit, Postgres, the app (built from
the root `Dockerfile`) on `hoopo.ir`, and the M0 `call-test` page on `hoopo.ir/call-test/`. Images are built on the Mac and
shipped over SSH; the VPS never builds or pulls anything.

| File            | What it is                                                                                |
| --------------- | ----------------------------------------------------------------------------------------- |
| `compose.yaml`  | The services, run from `/opt/molingo` on the VPS                                          |
| `Caddyfile`     | Port 443 split by SNI: HTTPS for `hoopo.ir` / `lk.hoopo.ir`, TURN/TLS for `turn.hoopo.ir` |
| `../Dockerfile` | The app (Next.js standalone), built for linux/amd64                                       |
| `livekit.yaml`  | LiveKit with embedded TURN (UDP 443, TLS via Caddy on 443), media on UDP 50000–50200      |
| `caddy/`        | Builds Caddy with `caddy-l4`                                                              |
| `call-test/`    | M0 test page and token service (no app, no database); reports go to `/data/reports.jsonl` |
| `backup.sh`     | Nightly `pg_dump` + uploads tarball (14 daily, 8 weekly), optional restic snapshot        |
| `ship.sh`       | Copies images and config, adds missing secrets to `.env`, migrates the database, restarts |

## Build and ship

```bash
docker buildx build --platform linux/amd64 -t molingo/caddy-l4:2.11.6 --load infra/caddy
docker pull --platform linux/amd64 livekit/livekit-server:v1.13.8
docker pull --platform linux/amd64 postgres:17-alpine
APP=m6-$(date +%Y%m%d%H%M)
docker buildx build --platform linux/amd64 -t molingo/app:$APP --load .
infra/ship.sh $APP            # add a call-test tag as the second argument to update that page too
```

`ship.sh` runs `pnpm db:migrate` from the Mac through an SSH tunnel (the database listens on the
VPS's loopback only). The owner account: open the same tunnel and run
`DATABASE_URL=… APP_URL=https://hoopo.ir pnpm user create --role owner --phone … --name …`, which
prints its one-time activation link. Teachers are then added on `/owner`.

SSH uses the project key in `.deploy/` (git-ignored). Secrets stay on the VPS in
`/opt/molingo/.env` (mode 600); read the test password with
`ssh … 'grep TEST_PASSWORD /opt/molingo/.env'`.

## Check on the server

```bash
cd /opt/molingo && docker compose ps && docker compose logs --tail 50 caddy livekit
docker compose exec call-test cat /data/reports.jsonl   # testers' connection reports
docker stats --no-stream                                # CPU and memory during a call
```

## Backups

`ship.sh` copies `backup.sh` to `/opt/molingo`. Install the nightly cron once on the VPS
(`crontab -e` as `deploy`):

```bash
30 3 * * * cd /opt/molingo && ./backup.sh >> backups/backup.log 2>&1
```

Backups land in `/opt/molingo/backups/{daily,weekly}`. For the off-box copy, install `restic` and put
`RESTIC_REPOSITORY` and `RESTIC_PASSWORD` in `/opt/molingo/.env` (a domestic target, PLAN §7);
without them only the local copy is made.

Restore drill, monthly, into a throwaway container (never the real database):

```bash
scripts/restore-test.sh                      # newest daily dump
scripts/restore-test.sh path/to/pg-2026-11-22.dump
```
