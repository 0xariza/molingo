// M0 call test: serves the test page, hands out LiveKit tokens to testers who know the shared
// password, and appends each tester's connection report to /data/reports.jsonl.
// No dependencies: LiveKit tokens are HS256 JWTs, signed with node:crypto.
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { join } from "node:path";

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};
const PORT = Number(process.env.PORT ?? 3001);
const LIVEKIT_URL = env("LIVEKIT_URL");
const API_KEY = env("LIVEKIT_API_KEY");
const API_SECRET = env("LIVEKIT_API_SECRET");
const PASSWORD = env("TEST_PASSWORD");
const REPORTS = process.env.REPORTS_FILE ?? "/data/reports.jsonl";
const ROOM = "m0-call-test";
const PUBLIC = join(import.meta.dirname, "public");

const CSP = [
  "default-src 'self'",
  `connect-src 'self' ${LIVEKIT_URL}`,
  "media-src 'self' blob:",
  "img-src 'self' data: blob:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");
const HEADERS = {
  "Content-Security-Policy": CSP,
  "Permissions-Policy": "camera=(self), microphone=(self)",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const STATIC = {
  "/call-test/": ["index.html", "text/html; charset=utf-8"],
  "/call-test/app.js": ["app.js", "text/javascript; charset=utf-8"],
  "/call-test/style.css": ["style.css", "text/css; charset=utf-8"],
};

const b64url = (data) => Buffer.from(data).toString("base64url");

/** A LiveKit access token for the test room, valid for three hours. */
function liveKitToken(identity, name) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      iss: API_KEY,
      sub: identity,
      name,
      nbf: now - 10,
      exp: now + 3 * 60 * 60,
      video: {
        room: ROOM,
        roomJoin: true,
        canPublish: true,
        canSubscribe: true,
        canPublishData: true,
        canUpdateOwnMetadata: true,
      },
    }),
  );
  const signature = createHmac("sha256", API_SECRET).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${signature}`;
}

const sha = (s) => createHash("sha256").update(s).digest();
const passwordMatches = (typed) => timingSafeEqual(sha(String(typed ?? "")), sha(PASSWORD));

// Wrong-password attempts per address, per 10 minutes.
const failures = new Map();
const LIMIT = 10;
function tooManyFailures(ip) {
  const entry = failures.get(ip);
  if (!entry || entry.until < Date.now()) return false;
  return entry.count >= LIMIT;
}
function recordFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || entry.until < Date.now()) failures.set(ip, { count: 1, until: Date.now() + 600_000 });
  else entry.count++;
}

/** Caddy passes the visitor's address (from the PROXY protocol) in X-Forwarded-For. */
const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "").split(",")[0].trim();

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) throw new Error("too large");
  }
  return JSON.parse(body || "{}");
}

function send(res, status, body, type = "application/json") {
  res.writeHead(status, { ...HEADERS, "Content-Type": type, "Cache-Control": "no-store" });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

const clean = (value, max) => String(value ?? "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/call-test")) {
      res.writeHead(302, { Location: "/call-test/" });
      return res.end();
    }
    if (req.method === "GET" && STATIC[url.pathname]) {
      const [file, type] = STATIC[url.pathname];
      return send(res, 200, await readFile(join(PUBLIC, file)), type);
    }
    if (req.method === "POST" && url.pathname === "/call-test/api/token") {
      const ip = clientIp(req);
      if (tooManyFailures(ip)) return send(res, 429, { error: "Too many wrong passwords. Wait 10 minutes." });
      const { name, password } = await readJson(req);
      if (!passwordMatches(password)) {
        recordFailure(ip);
        return send(res, 403, { error: "Wrong test password." });
      }
      const display = clean(name, 40);
      if (display.length < 2) return send(res, 400, { error: "Enter your name." });
      const identity = `${display.replace(/\s+/g, "-").toLowerCase()}-${randomUUID().slice(0, 6)}`;
      return send(res, 200, { url: LIVEKIT_URL, token: liveKitToken(identity, display), identity });
    }
    if (req.method === "POST" && url.pathname === "/call-test/api/report") {
      const report = await readJson(req);
      const line = {
        at: new Date().toISOString(),
        ip: clientIp(req),
        ua: clean(req.headers["user-agent"], 300),
        event: clean(report.event, 20),
        name: clean(report.name, 40),
        network: clean(report.network, 30),
        vpn: Boolean(report.vpn),
        mode: clean(report.mode, 10),
        audioOnly: Boolean(report.audioOnly),
        path: clean(report.path, 20),
        rttMs: Number.isFinite(report.rttMs) ? report.rttMs : null,
        seconds: Number.isFinite(report.seconds) ? report.seconds : null,
        reconnects: Number.isFinite(report.reconnects) ? report.reconnects : null,
        error: clean(report.error, 300),
      };
      await appendFile(REPORTS, `${JSON.stringify(line)}\n`);
      console.log("report", JSON.stringify(line));
      return send(res, 204, "");
    }
    send(res, 404, { error: "Not found" });
  } catch (error) {
    console.error(error);
    send(res, 400, { error: "Bad request" });
  }
});

server.listen(PORT, () => console.log(`call-test on :${PORT}, room ${ROOM}`));
