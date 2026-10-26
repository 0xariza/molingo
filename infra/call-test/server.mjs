// M6 classroom prototype (built on the M0 call test): serves the page, hands out LiveKit tokens
// to testers who know the shared password (or the teacher password, for Mona's role), lets the
// teacher moderate through LiveKit's server API, and appends connection reports to
// /data/reports.jsonl. No dependencies: LiveKit tokens are HS256 JWTs, signed with node:crypto.
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join } from "node:path";

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
};
const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";
const LIVEKIT_URL = env("LIVEKIT_URL");
const LIVEKIT_HTTP = process.env.LIVEKIT_HTTP ?? "http://127.0.0.1:7880";
const API_KEY = env("LIVEKIT_API_KEY");
const API_SECRET = env("LIVEKIT_API_SECRET");
const PASSWORD = env("TEST_PASSWORD");
const TEACHER_PASSWORD = env("TEACHER_PASSWORD");
const REPORTS = process.env.REPORTS_FILE ?? "/data/reports.jsonl";
const ROOM = "m0-call-test";
const PUBLIC = join(import.meta.dirname, "public");

const CSP = [
  "default-src 'self'",
  `connect-src 'self' ${LIVEKIT_URL}`,
  "media-src 'self' blob:",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join("; ");
const HEADERS = {
  "Content-Security-Policy": CSP,
  "Permissions-Policy": "camera=(self), microphone=(self), display-capture=(self)",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};
const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
};

const b64url = (data) => Buffer.from(data).toString("base64url");

function jwt(claims) {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({ iss: API_KEY, nbf: now - 10, exp: now + 3 * 60 * 60, ...claims }),
  );
  const signature = createHmac("sha256", API_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");
  return `${header}.${payload}.${signature}`;
}

/** A LiveKit access token for the test room. The teacher may also share their screen. */
const liveKitToken = (identity, name, role) =>
  jwt({
    sub: identity,
    name,
    attributes: { role },
    video: {
      room: ROOM,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      canUpdateOwnMetadata: true,
      ...(role === "teacher"
        ? { roomAdmin: true }
        : { canPublishSources: ["camera", "microphone"] }),
    },
  });

/** Calls LiveKit's RoomService (Twirp, JSON) as a room admin. */
async function roomService(method, body) {
  const res = await fetch(`${LIVEKIT_HTTP}/twirp/livekit.RoomService/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwt({ video: { room: ROOM, roomAdmin: true } })}`,
    },
    body: JSON.stringify({ room: ROOM, ...body }),
  });
  if (!res.ok) throw new Error(`${method}: ${res.status} ${await res.text()}`);
}

const sha = (s) => createHash("sha256").update(s).digest();
const matches = (typed, secret) => timingSafeEqual(sha(String(typed ?? "")), sha(secret));

// Wrong-password attempts per address, per 10 minutes.
const failures = new Map();
const LIMIT = 10;
function tooManyFailures(ip) {
  const entry = failures.get(ip);
  return Boolean(entry && entry.until > Date.now() && entry.count >= LIMIT);
}
function recordFailure(ip) {
  const entry = failures.get(ip);
  if (!entry || entry.until < Date.now())
    failures.set(ip, { count: 1, until: Date.now() + 600_000 });
  else entry.count++;
}

/** Caddy passes the visitor's address (from the PROXY protocol) in X-Forwarded-For. */
const clientIp = (req) =>
  String(req.headers["x-forwarded-for"] ?? req.socket.remoteAddress ?? "")
    .split(",")[0]
    .trim();

async function readJson(req) {
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 4096) throw new Error("too large");
  }
  return JSON.parse(body || "{}");
}

function send(res, status, body, type = "application/json") {
  const cache = type.startsWith("font/") ? "public, max-age=31536000, immutable" : "no-store";
  res.writeHead(status, { ...HEADERS, "Content-Type": type, "Cache-Control": cache });
  res.end(type === "application/json" ? JSON.stringify(body) : body);
}

const clean = (value, max) =>
  String(value ?? "")
    .replace(/[\u0000-\u001f]/g, "")
    .trim()
    .slice(0, max);

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/call-test")) {
      res.writeHead(302, { Location: "/call-test/" });
      return res.end();
    }
    // The page and its bundled files: plain file names only, no folders.
    const file =
      url.pathname === "/call-test/" ? "index.html" : url.pathname.replace(/^\/call-test\//, "");
    if (req.method === "GET" && /^[\w.-]+$/.test(file) && TYPES[extname(file)]) {
      return send(res, 200, await readFile(join(PUBLIC, file)), TYPES[extname(file)]);
    }
    if (req.method === "POST" && url.pathname === "/call-test/api/token") {
      const ip = clientIp(req);
      if (tooManyFailures(ip))
        return send(res, 429, { error: "رمز اشتباه زیاد بود. ۱۰ دقیقه صبر کن." });
      const { name, password } = await readJson(req);
      const role = matches(password, TEACHER_PASSWORD)
        ? "teacher"
        : matches(password, PASSWORD)
          ? "learner"
          : null;
      if (!role) {
        recordFailure(ip);
        return send(res, 403, { error: "رمز آزمایش درست نیست." });
      }
      const display = clean(name, 40);
      if (display.length < 2) return send(res, 400, { error: "اسمت را بنویس." });
      const identity = `${role}-${randomUUID().slice(0, 8)}`;
      return send(res, 200, {
        url: LIVEKIT_URL,
        token: liveKitToken(identity, display, role),
        identity,
        role,
      });
    }
    if (req.method === "POST" && url.pathname === "/call-test/api/moderate") {
      const { password, action, identity, trackSid, others } = await readJson(req);
      if (!matches(password, TEACHER_PASSWORD)) return send(res, 403, { error: "Teacher only." });
      const who = clean(identity, 64);
      if (action === "mute")
        await roomService("MutePublishedTrack", {
          identity: who,
          track_sid: clean(trackSid, 64),
          muted: true,
        });
      else if (action === "remove") await roomService("RemoveParticipant", { identity: who });
      else if (action === "lowerHand")
        await roomService("UpdateParticipant", { identity: who, attributes: { hand: "" } });
      else if (action === "giveTurn") {
        // One turn at a time: clear it from everyone else first.
        for (const other of [].concat(others ?? []).slice(0, 10))
          await roomService("UpdateParticipant", {
            identity: clean(other, 64),
            attributes: { turn: "" },
          });
        await roomService("UpdateParticipant", {
          identity: who,
          attributes: { hand: "", turn: "1" },
        });
      } else return send(res, 400, { error: "Unknown action." });
      return send(res, 204, "");
    }
    if (req.method === "POST" && url.pathname === "/call-test/api/report") {
      const report = await readJson(req);
      const line = {
        at: new Date().toISOString(),
        ip: clientIp(req),
        ua: clean(req.headers["user-agent"], 300),
        event: clean(report.event, 20),
        name: clean(report.name, 40),
        role: clean(report.role, 10),
        network: clean(report.network, 30),
        vpn: Boolean(report.vpn),
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

server.listen(PORT, HOST, () => console.log(`call-test on ${HOST}:${PORT}, room ${ROOM}`));
