import { hasLocale } from "next-intl";
import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intl = createMiddleware(routing);

export default function proxy(request: NextRequest) {
  // `localeDetection: false` ignores Accept-Language *and* the cookie, but we do want
  // to remember an explicit choice: unprefixed paths go to the saved locale.
  const { pathname, search } = request.nextUrl;
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
  return intl(request);
}

export const config = {
  // Everything except API routes, share links (/j/*), Next internals and files with an extension.
  matcher: ["/((?!api|j/|_next|_vercel|.*\\..*).*)"],
};
