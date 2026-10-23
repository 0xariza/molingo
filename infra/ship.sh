#!/usr/bin/env bash
# Ships the M0 stack to the VPS: copies the images (docker save | ssh | docker load, no registry),
# the config files, creates /opt/molingo/.env with fresh secrets on the first run, and restarts.
# Build the images first (see infra/README.md). Usage: infra/ship.sh <call-test tag>
set -euo pipefail
cd "$(dirname "$0")"

TAG="${1:?usage: ship.sh <call-test tag>}"
HOST="${DEPLOY_HOST:-deploy@185.211.58.77}"
KEY="${DEPLOY_KEY:-../.deploy/id_ed25519}"
DIR=/opt/molingo
SSH=(ssh -o BatchMode=yes -o IdentitiesOnly=yes -i "$KEY" "$HOST")
IMAGES=(molingo/caddy-l4:2.11.6 livekit/livekit-server:v1.13.8 "molingo/call-test:$TAG")

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
COPYFILE_DISABLE=1 tar --no-mac-metadata -cf - compose.yaml Caddyfile livekit.yaml | "${SSH[@]}" "tar -xf - -C $DIR"

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
sed -i "s/^CALL_TEST_TAG=.*/CALL_TEST_TAG=$TAG/" .env
EOF

echo "→ start"
"${SSH[@]}" "cd $DIR && docker compose up -d --remove-orphans && docker compose ps --format '{{.Service}}: {{.State}}'"
