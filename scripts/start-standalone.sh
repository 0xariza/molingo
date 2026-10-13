#!/bin/sh
# Runs the production build the way it is deployed (Next.js standalone output).
# The standalone server needs the static assets and public/ next to it.
set -e
cp -R public .next/standalone/
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/
exec node .next/standalone/server.js
