import { hasLocale } from "next-intl";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { shareLinkSession } from "@/server/live/room";

/**
 * A class share link (PLAN §4): sends the learner to the pre-join of the class's current or next
 * session. It grants nothing: the login check (proxy) and the join rule (the page) still apply.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/j/[id]">) {
  const saved = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = hasLocale(routing.locales, saved) ? saved : routing.defaultLocale;
  const session = await shareLinkSession((await params).id);
  const path = session ? `/${locale}/app/classroom/${session}` : `/${locale}/app`;
  return NextResponse.redirect(new URL(path, request.url));
}
