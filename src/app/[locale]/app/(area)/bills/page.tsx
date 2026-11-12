import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StatusTag } from "@/components/admin/finance/status-tag";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatToman, fromTehranTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { requireStudent } from "@/server/auth/current";
import { learnerBills } from "@/server/billing/learner";
import { jalaliMonthLabel } from "@/server/billing/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.bills");
  return { title: t("title") };
}

export default function BillsPage() {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Bills />
    </Suspense>
  );
}

async function Bills() {
  const user = await requireStudent();
  const [t, locale, { due, credit, bills }] = await Promise.all([
    getTranslations("Student.bills"),
    getLocale() as Promise<Locale>,
    learnerBills(user.id),
  ]);
  const money = (n: number) => formatToman(n, locale);
  const next = bills
    .filter((b) => b.left > 0)
    .sort((a, b) => (a.dueOn ?? "").localeCompare(b.dueOn ?? ""))[0];
  return (
    <div className="space-y-5">
      <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
      <section aria-label={t("due")} className="space-y-2 rounded-card bg-ocean p-6 text-white">
        <p className="text-sm font-bold text-room-cinnamon">{t("due")}</p>
        <p className="text-4xl font-extrabold">{money(due)}</p>
        {credit > 0 && <p className="text-sm">{t("credit", { amount: money(credit) })}</p>}
        {next && (
          <Link
            href={`/app/bills/${next.id}`}
            className="inline-flex min-h-touch items-center rounded-[14px] bg-room-cinnamon px-6 font-bold text-navy"
          >
            {t("pay")}
          </Link>
        )}
      </section>
      {bills.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-mist rounded-card border border-hairline bg-white">
          {bills.map((b) => (
            <li key={b.id}>
              <Link href={`/app/bills/${b.id}`} className="flex items-center gap-3 px-4 py-3">
                <span className="min-w-0 flex-1">
                  <b className="block text-ocean">
                    {b.period
                      ? t("monthly", { month: jalaliMonthLabel(b.period, locale) })
                      : t("course")}
                  </b>
                  <span className="text-sm">
                    {classTitle({ nameFa: b.classFa, nameEn: b.classEn }, locale)}
                    {b.dueOn && b.left > 0
                      ? ` · ${t("dueOn", { date: formatDate(fromTehranTime(b.dueOn, "12:00"), locale, { year: false }) })}`
                      : ""}
                  </span>
                </span>
                <span className="text-end">
                  <b className="block text-ocean">{money(b.total)}</b>
                  {b.pendingReceipts > 0 && b.left > 0 ? (
                    <span className="inline-flex rounded-pill bg-[#fdf3dc] px-3 py-0.5 text-sm font-bold text-[#6b4e00]">
                      {t("receiptPending")}
                    </span>
                  ) : (
                    <StatusTag state={b.state} partial={b.partial} />
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="rounded-card bg-surface p-4 text-sm">{t("note")}</p>
    </div>
  );
}
