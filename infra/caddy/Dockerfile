# Caddy with the layer4 plugin: HTTPS, LiveKit signalling and TURN/TLS share port 443 by SNI.
# Built natively on the build machine and cross-compiled for the server's architecture.
FROM --platform=$BUILDPLATFORM caddy:2.11.6-builder AS builder
ARG TARGETOS TARGETARCH
RUN GOOS=$TARGETOS GOARCH=$TARGETARCH xcaddy build --with github.com/mholt/caddy-l4@42db5690dea199f930a6f08005fe2e4aab10dcc9

FROM caddy:2.11.6
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
