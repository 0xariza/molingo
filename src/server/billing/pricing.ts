import type { Locale } from "@/i18n/routing";
import { addDays } from "@/lib/schedule";
import { formatJalaliMonth } from "@/lib/format";

export type PriceChange = { effectiveFrom: string; priceToman: number };

/** The price of a session on `dateKey`: the latest change on or before it, else the class's base price. */
export function priceOn(base: number, changes: PriceChange[], dateKey: string): number {
  let price = base;
  let from = "";
  for (const c of changes) {
    if (c.effectiveFrom <= dateKey && c.effectiveFrom >= from) {
      price = c.priceToman;
      from = c.effectiveFrom;
    }
  }
  return price;
}

export type InvoiceState = "draft" | "void" | "paid" | "overdue" | "partial" | "open";

/** What an invoice is, from its status, money and dates. `partial` also marks a partly paid overdue one. */
export function invoiceState(
  i: { status: "draft" | "issued" | "void"; total: number; paid: number; dueOn: string | null },
  graceDays: number,
  todayKey: string,
): { state: InvoiceState; partial: boolean; left: number } {
  const left = Math.max(0, i.total - i.paid);
  const partial = i.paid > 0 && left > 0;
  if (i.status !== "issued") return { state: i.status, partial: false, left };
  if (left === 0) return { state: "paid", partial: false, left };
  const late = i.dueOn !== null && todayKey > addDays(i.dueOn, graceDays);
  return { state: late ? "overdue" : partial ? "partial" : "open", partial, left };
}

/** "1405-08" → "آبان" / "Aban". Month lengths vary, so aim for the middle of the month. */
export function jalaliMonthLabel(period: string, locale: Locale): string {
  const [y, m] = period.split("-").map(Number);
  const dayOfYear = m <= 6 ? (m - 1) * 31 : 186 + (m - 7) * 30;
  const date = new Date(Date.UTC(y + 621, 2, 21 + dayOfYear + 14, 12));
  return formatJalaliMonth(date, locale);
}
