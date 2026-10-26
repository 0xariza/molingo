/**
 * HTTP security headers for every response (applied in next.config.ts).
 *
 * CSP without nonces: nonces force per-request rendering, which conflicts with the prerendered
 * shells of Cache Components / PPR. Inline scripts (Next's RSC payload) therefore need
 * 'unsafe-inline'; everything else is limited to our own origin — no CDNs, no third parties.
 * HSTS is added by Caddy, which terminates TLS.
 * The live classroom adds the LiveKit server (`LIVEKIT_URL`, read at build time) to connect-src:
 * its WebSocket for signaling and its HTTPS origin, which the client probes when a connection fails.
 */
export function securityHeaders({ isDev, liveKitUrl }: { isDev: boolean; liveKitUrl?: string }) {
  const liveKit = liveKitUrl ? new URL(liveKitUrl) : null;
  const liveKitSources = liveKit
    ? ` ${liveKit.protocol}//${liveKit.host} ${liveKit.protocol === "wss:" ? "https:" : "http:"}//${liveKit.host}`
    : "";
  const csp = [
    "default-src 'self'",
    // React needs eval in development for debugging features.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self'${liveKitSources}`,
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ");

  // Camera, microphone and screen sharing are for our own live classroom only.
  const permissions = [
    "camera=(self)",
    "microphone=(self)",
    "display-capture=(self)",
    "fullscreen=(self)",
    "screen-wake-lock=(self)",
    "autoplay=(self)",
    "geolocation=()",
    "payment=()",
    "usb=()",
    "browsing-topics=()",
  ].join(", ");

  return [
    { key: "Content-Security-Policy", value: csp },
    { key: "Permissions-Policy", value: permissions },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ];
}
