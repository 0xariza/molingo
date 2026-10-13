// Kept free of imports so the proxy can use it without bundling the DB client.
export const SESSION_COOKIE = "molingo_session";
export const SESSION_DAYS = 30;

/** Secure whenever the app is served over HTTPS (always in production, behind Caddy). */
const servedOverHttps = process.env.APP_URL
  ? process.env.APP_URL.startsWith("https://")
  : process.env.NODE_ENV === "production";

export const sessionCookieOptions = {
  httpOnly: true,
  secure: servedOverHttps,
  sameSite: "lax" as const,
  path: "/",
  maxAge: SESSION_DAYS * 24 * 60 * 60,
};
