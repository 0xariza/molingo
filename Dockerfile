# The app for the VPS (PLAN §7): built on the Mac for linux/amd64 and shipped with infra/ship.sh;
# the VPS never builds or pulls. The build runs on amd64 too (emulated on Apple silicon) so the
# native Argon2 binding in the standalone output matches the server.
FROM node:22.23.1-alpine AS build
WORKDIR /build
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
# The browser's LiveKit address goes into the security headers at build time.
ARG LIVEKIT_URL=wss://lk.hoopo.ir
ENV LIVEKIT_URL=$LIVEKIT_URL NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

FROM node:22.23.1-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=127.0.0.1
COPY --from=build --chown=node:node /build/.next/standalone ./
COPY --from=build --chown=node:node /build/.next/static ./.next/static
COPY --from=build --chown=node:node /build/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
