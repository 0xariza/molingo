import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { SESSION_COOKIE, sessionCookieOptions } from "./server/auth/constants";

const intl = createMiddleware(routing);
const PROTECTED = new RegExp(`^/(${routing.locales.join("|")})(/(?:admin|app))(/.*)?$`);

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // `localeDetection: false` ignores Accept-Language *and* the cookie, but we do want
  // to remember an explicit choice: unprefixed paths go to the saved locale.
  const prefixed = routing.locales.some(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`),
  );
  const saved = request.cookies.get("NEXT_LOCALE")?.value;
  if (!prefixed && hasLocale(routing.locales, saved)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${saved}${pathname === "/" ? "" : pathname}`;
    url.search = search;
    return NextResponse.redirect(url);
  }

  const session = request.cookies.get(SESSION_COOKIE)?.value;

  // Optimistic check only (no DB): no cookie → login. Pages and actions do the real check.
  const match = PROTECTED.exec(pathname);
  if (match && !session) {
    const url = request.nextUrl.clone();
    url.pathname = `/${match[1]}/login`;
    url.search = `?next=${encodeURIComponent(match[2] + (match[3] ?? ""))}`;
    return NextResponse.redirect(url);
  }

  const response = intl(request);

  // Keep the cookie's lifetime in step with the sliding session (renewed in the DB on use).
  // Server Components can't set cookies, so this happens here on page loads.
  if (session && request.method === "GET") {
    response.cookies.set(SESSION_COOKIE, session, sessionCookieOptions);
  }
  return response;
}

export const config = {
  // Everything except API routes, share links (/j/*), Next internals and files with an extension.
  matcher: ["/((?!api|j/|_next|_vercel|.*\\..*).*)"],
};
