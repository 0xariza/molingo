#!/usr/bin/env bash
# Ships the stack to the VPS: copies the images (docker save | ssh | docker load, no registry),
# the config files, creates /opt/molingo/.env with fresh secrets on the first run, and restarts.
# Build the images first (see infra/README.md).
# Usage: infra/ship.sh <app tag> [call-test tag]   (without a call-test tag the running one stays)
set -euo pipefail
cd "$(dirname "$0")"

APP_TAG="${1:?usage: ship.sh <app tag> [call-test tag]}"
HOST="${DEPLOY_HOST:-deploy@185.211.58.77}"
KEY="${DEPLOY_KEY:-../.deploy/id_ed25519}"
DIR=/opt/molingo
SSH=(ssh -o BatchMode=yes -o IdentitiesOnly=yes -i "$KEY" "$HOST")
TAG="${2:-$("${SSH[@]}" "sed -n 's/^CALL_TEST_TAG=//p' $DIR/.env 2>/dev/null")}"
TAG="${TAG:?no call-test tag given and none on the server}"
IMAGES=(molingo/caddy-l4:2.11.6 livekit/livekit-server:v1.13.8 postgres:17-alpine
  "molingo/call-test:$TAG" "molingo/app:$APP_TAG")

echo "→ images"
for image in "${IMAGES[@]}"; do
  if "${SSH[@]}" "docker image inspect $image >/dev/null 2>&1"; then
    echo "  $image already there"
  else
    echo "  $image"
    docker save "$image" | gzip -1 | "${SSH[@]}" "gunzip | docker load -q"
  fi
done

echo "→ config"
"${SSH[@]}" "sudo mkdir -p $DIR && sudo chown deploy:deploy $DIR"
SUMS="cd $DIR && sha256sum Caddyfile livekit.yaml 2>/dev/null || true"
BEFORE="$("${SSH[@]}" "$SUMS")"
COPYFILE_DISABLE=1 tar --no-mac-metadata -cf - compose.yaml Caddyfile livekit.yaml | "${SSH[@]}" "tar -xf - -C $DIR"
# The files are mounted one by one, so a container keeps seeing the old copy until recreated.
RECREATE=()
while read -r sum file; do
  grep -q "$sum  $file" <<<"$BEFORE" || RECREATE+=("$([ "$file" = Caddyfile ] && echo caddy || echo livekit)")
done <<<"$("${SSH[@]}" "$SUMS")"

echo "→ secrets"
"${SSH[@]}" bash -s <<EOF
set -euo pipefail
cd $DIR
if [ ! -f .env ]; then
  umask 077
  {
    echo "DOMAIN=hoopo.ir"
    echo "PUBLIC_IP=185.211.58.77"
    echo "LIVEKIT_API_KEY=API\$(openssl rand -hex 6)"
    echo "LIVEKIT_API_SECRET=\$(openssl rand -hex 32)"
    echo "TEST_PASSWORD=\$(openssl rand -hex 3)"
    echo "CALL_TEST_TAG=$TAG"
  } > .env
  echo "  created .env"
fi
grep -q '^TEACHER_PASSWORD=' .env || echo "TEACHER_PASSWORD=\$(openssl rand -hex 4)" >> .env
grep -q '^POSTGRES_PASSWORD=' .env || echo "POSTGRES_PASSWORD=\$(openssl rand -hex 24)" >> .env
grep -q '^APP_TAG=' .env || echo "APP_TAG=" >> .env
sed -i "s/^CALL_TEST_TAG=.*/CALL_TEST_TAG=$TAG/; s/^APP_TAG=.*/APP_TAG=$APP_TAG/" .env
EOF

echo "→ database"
# Postgres first, then the migrations from this machine through an SSH tunnel to its loopback port.
"${SSH[@]}" "cd $DIR && docker compose up -d --wait db"
PG_PASSWORD="$("${SSH[@]}" "sed -n 's/^POSTGRES_PASSWORD=//p' $DIR/.env")"
ssh -o BatchMode=yes -o IdentitiesOnly=yes -o ExitOnForwardFailure=yes -i "$KEY" \
  -N -L 15432:127.0.0.1:5432 "$HOST" &
TUNNEL=$!
trap 'kill $TUNNEL 2>/dev/null' EXIT
# The SSH handshake to the VPS takes a few seconds; migrating before the tunnel is up fails silently.
for _ in $(seq 30); do nc -z 127.0.0.1 15432 2>/dev/null && break; sleep 0.5; done
nc -z 127.0.0.1 15432 || { echo "SSH tunnel to the database did not open" >&2; exit 1; }
(cd .. && DATABASE_URL="postgres://molingo:$PG_PASSWORD@127.0.0.1:15432/molingo" pnpm -s db:migrate)

echo "→ start"
"${SSH[@]}" "cd $DIR && docker compose up -d --remove-orphans"
if [ ${#RECREATE[@]} -gt 0 ]; then
  "${SSH[@]}" "cd $DIR && docker compose up -d --force-recreate ${RECREATE[*]}"
fi
"${SSH[@]}" "cd $DIR && docker compose ps --format '{{.Service}}: {{.State}}'"
