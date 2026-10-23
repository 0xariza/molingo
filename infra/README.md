# Production infrastructure

The VPS stack (PLAN.md §7): Caddy with the layer4 plugin, LiveKit, and — for **M0** — the
`call-test` page that checks video calls work on Iranian networks. Images are built on the Mac and
shipped over SSH; the VPS never builds or pulls anything.

| File           | What it is                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------- |
| `compose.yaml` | The services, run from `/opt/molingo` on the VPS                                            |
| `Caddyfile`    | Port 443 split by SNI: HTTPS for `hoopo.ir` / `lk.hoopo.ir`, TURN/TLS for `turn.hoopo.ir`   |
| `livekit.yaml` | LiveKit with embedded TURN (UDP 3478, TLS via Caddy on 443), media on UDP 50000–50200       |
| `caddy/`       | Builds Caddy with `caddy-l4`                                                                |
| `call-test/`   | M0 test page and token service (no app, no database); reports go to `/data/reports.jsonl`   |
| `ship.sh`      | Copies images and config to the VPS, creates `.env` with secrets on the first run, restarts |

## Build and ship

```bash
docker buildx build --platform linux/amd64 -t molingo/caddy-l4:2.11.6 --load infra/caddy
docker pull --platform linux/amd64 livekit/livekit-server:v1.13.8
TAG=m0-$(date +%Y%m%d%H%M)
docker buildx build --platform linux/amd64 -t molingo/call-test:$TAG --load infra/call-test
infra/ship.sh $TAG
```

SSH uses the project key in `.deploy/` (git-ignored). Secrets stay on the VPS in
`/opt/molingo/.env` (mode 600); read the test password with
`ssh … 'grep TEST_PASSWORD /opt/molingo/.env'`.

## Check on the server

```bash
cd /opt/molingo && docker compose ps && docker compose logs --tail 50 caddy livekit
docker compose exec call-test cat /data/reports.jsonl   # testers' connection reports
docker stats --no-stream                                # CPU and memory during a call
```
