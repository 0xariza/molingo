import { eq } from "drizzle-orm";
import { hasLocale } from "next-intl";
import { type NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { invoices } from "@/db/schema";
import { routing } from "@/i18n/routing";

/**
 * The link in a billing SMS: sends the learner to that bill. It grants nothing: the login check
 * (proxy) and the owner check (the page) still apply.
 */
export async function GET(request: NextRequest, { params }: RouteContext<"/b/[code]">) {
  const saved = request.cookies.get("NEXT_LOCALE")?.value;
  const locale = hasLocale(routing.locales, saved) ? saved : routing.defaultLocale;
  const [row] = await db
    .select({ id: invoices.id })
    .from(invoices)
    .where(eq(invoices.shortCode, (await params).code));
  const path = `/${locale}/app/bills${row ? `/${row.id}` : ""}`;
  return NextResponse.redirect(new URL(path, process.env.APP_URL ?? request.url));
}
