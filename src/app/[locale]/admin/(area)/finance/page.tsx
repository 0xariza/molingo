import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StatusTag } from "@/components/admin/finance/status-tag";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import {
  formatDate,
  formatToman,
  fromTehranTime,
  jalaliMonthKey,
  recentJalaliMonths,
} from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { remindAction } from "@/server/billing/actions";
import { jalaliMonthLabel } from "@/server/billing/pricing";
import {
  creditsByLearner,
  incomeByMonth,
  listInvoiceRows,
  listPayments,
  pendingReceiptCount,
  type InvoiceRow,
  type PaymentRow,
} from "@/server/billing/reports";
import { runBillingSweep } from "@/server/billing/sweep";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.finance");
  return { title: t("title") };
}

export default function FinancePage({ searchParams }: PageProps<"/[locale]/admin/finance">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Finance searchParams={searchParams} />
    </Suspense>
  );
}

const card = "rounded-card border border-hairline bg-white p-5";
const th = "px-3 py-2 text-start text-sm font-bold text-body";
const td = "px-3 py-2.5";

const BY = ["month", "class", "learner"] as const;
type By = (typeof BY)[number];

async function Finance({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  await runBillingSweep(teacherId);
  const raw = (await searchParams).by;
  const by: By = BY.find((b) => b === raw) ?? "month";
  const now = new Date();

  const [t, locale, rows, pays, credits, pending] = await Promise.all([
    getTranslations("Admin.finance"),
    getLocale() as Promise<Locale>,
    listInvoiceRows(teacherId, now),
    listPayments(teacherId),
    creditsByLearner(teacherId),
    pendingReceiptCount(teacherId),
  ]);
  const money = (n: number) => formatToman(n, locale);
  const name = (r: { fullNameFa: string; fullNameEn: string | null }) =>
    learnerNames(r, locale).primary;
  const thisMonth = jalaliMonthKey(now);
  const income = incomeByMonth(pays);
  const drafts = rows.filter((r) => r.state === "draft");
  const open = rows.filter((r) => r.status === "issued" && r.left > 0);
  const overdue = rows.filter((r) => r.state === "overdue");
  const sum = (list: InvoiceRow[]) => list.reduce((n, r) => n + r.left, 0);
  const creditTotal = [...credits.values()].reduce((a, b) => a + b, 0);
  const invoiceClass = new Map(rows.map((r) => [r.id, r]));
  const received = (p: PaymentRow) =>
    jalaliMonthKey(fromTehranTime(p.paidOn, "12:00")) === thisMonth;

  const classRows = [...new Set(rows.map((r) => r.classId))].map((id) => {
    const mine = rows.filter((r) => r.classId === id);
    return {
      key: id,
      label: classTitle({ nameFa: mine[0].classFa, nameEn: mine[0].classEn }, locale),
      received: pays
        .filter((p) => p.invoiceId && invoiceClass.get(p.invoiceId)?.classId === id && received(p))
        .reduce((n, p) => n + p.amount, 0),
      open: sum(mine.filter((r) => r.status === "issued")),
    };
  });
  const learnerRows = [...new Set(rows.map((r) => r.studentId))].map((id) => {
    const mine = rows.filter((r) => r.studentId === id);
    return {
      key: id,
      label: name(mine[0]),
      received: pays
        .filter((p) => p.studentId === id && received(p))
        .reduce((n, p) => n + p.amount, 0),
      open: sum(mine.filter((r) => r.status === "issued")),
    };
  });
  const months = recentJalaliMonths(now, 6).map((m) => ({
    key: m.key,
    label: jalaliMonthLabel(m.key, locale),
    total: income.get(m.key) ?? 0,
  }));
  const top = Math.max(1, ...months.map((m) => m.total));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
          <p className="mt-1">{t("lead")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/finance/invoices" className={buttonClass("primary")}>
            {t("nav.invoices")}
          </Link>
          <Link href="/admin/finance/receipts" className={buttonClass("ghost")}>
            {t("nav.receipts")}
          </Link>
          <Link href="/admin/finance/settings" className={buttonClass("quiet")}>
            {t("nav.settings")}
          </Link>
        </div>
      </header>

      {drafts.length > 0 && (
        <Link
          href="/admin/finance/invoices"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-brand bg-surface p-5"
        >
          <span>
            <b className="block text-ocean">{t("banner.drafts", { count: drafts.length })}</b>
            <span className="text-sm">
              {t("banner.draftsLead", { total: money(drafts.reduce((n, r) => n + r.total, 0)) })}
            </span>
          </span>
          <span className="font-bold text-brand">{t("banner.review")}</span>
        </Link>
      )}
      {pending > 0 && (
        <Link
          href="/admin/finance/receipts"
          className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[#f2d48a] bg-[#fffaf0] p-5"
        >
          <b className="text-ocean">{t("banner.receipts", { count: pending })}</b>
          <span className="font-bold text-brand">{t("banner.see")}</span>
        </Link>
      )}

      <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className={card}>
          <dt className="text-sm font-bold">
            {t("stats.income", { month: jalaliMonthLabel(thisMonth, locale) })}
          </dt>
          <dd className="text-2xl font-extrabold text-ocean">
            {money(income.get(thisMonth) ?? 0)}
          </dd>
        </div>
        <div className={card}>
          <dt className="text-sm font-bold">{t("stats.open")}</dt>
          <dd className="text-2xl font-extrabold text-ocean">{money(sum(open))}</dd>
          <dd className="text-sm">{t("stats.openCount", { count: open.length })}</dd>
        </div>
        <div className={`${card} ${overdue.length ? "border-red-300" : ""}`}>
          <dt className="text-sm font-bold">{t("stats.overdue")}</dt>
          <dd className="text-2xl font-extrabold text-red-700">{money(sum(overdue))}</dd>
          <dd className="text-sm">
            {t("stats.overdueCount", { count: new Set(overdue.map((r) => r.studentId)).size })}
          </dd>
        </div>
        <div className={card}>
          <dt className="text-sm font-bold">{t("stats.credit")}</dt>
          <dd className="text-2xl font-extrabold text-ocean">{money(creditTotal)}</dd>
        </div>
      </dl>

      {overdue.length > 0 && (
        <section aria-labelledby="od" className={`${card} space-y-3`}>
          <h2 id="od" className="font-sans text-lg font-extrabold normal-case tracking-normal">
            {t("overdue.title")}
          </h2>
          <ul className="divide-y divide-mist">
            {overdue.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <Link href={`/admin/finance/invoices/${r.id}`} className="min-w-0 flex-1">
                  <b className="block text-ocean">{name(r)}</b>
                  <span className="text-sm">
                    {classTitle({ nameFa: r.classFa, nameEn: r.classEn }, locale)}
                  </span>
                  <span className="block text-sm">
                    {t("overdue.since", {
                      date: formatDate(fromTehranTime(r.dueOn!, "12:00"), locale, {
                        weekday: false,
                        year: false,
                      }),
                    })}
                  </span>
                </Link>
                <b className="text-red-700">{money(r.left)}</b>
                <StatusTag state={r.state} partial={r.partial} />
                <form action={remindAction}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={buttonClass("ghost", "min-h-10 px-4 text-sm")}>
                    {t("overdue.remind")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <p className="text-sm">{t("overdue.note")}</p>
        </section>
      )}

      <section aria-labelledby="inc" className={`${card} space-y-4`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="inc" className="font-sans text-lg font-extrabold normal-case tracking-normal">
            {t("income.title")}
          </h2>
          <nav aria-label={t("income.title")} className="flex gap-1">
            {BY.map((b) => (
              <Link
                key={b}
                href={`/admin/finance?by=${b}`}
                aria-current={b === by ? "page" : undefined}
                className="min-h-touch rounded-pill px-4 py-2 font-bold text-brand aria-[current=page]:bg-ocean aria-[current=page]:text-white"
              >
                {t(`income.by.${b}`)}
              </Link>
            ))}
          </nav>
        </div>
        {by === "month" ? (
          <ul className="space-y-2">
            {months.map((m) => (
              <li key={m.key} className="grid grid-cols-[5rem_1fr_auto] items-center gap-3">
                <span>{m.label}</span>
                <span aria-hidden className="h-3 rounded-pill bg-mist">
                  <span
                    className="block h-3 rounded-pill bg-brand"
                    style={{ width: `${(m.total / top) * 100}%` }}
                  />
                </span>
                <b className="text-ocean">{money(m.total)}</b>
              </li>
            ))}
          </ul>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    {t(`income.by.${by}`)}
                  </th>
                  <th scope="col" className={th}>
                    {t("income.received", { month: jalaliMonthLabel(thisMonth, locale) })}
                  </th>
                  <th scope="col" className={th}>
                    {t("income.open")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {(by === "class" ? classRows : learnerRows).map((r) => (
                  <tr key={r.key}>
                    <td className={`${td} font-bold text-ocean`}>{r.label}</td>
                    <td className={td}>{money(r.received)}</td>
                    <td className={td}>{money(r.open)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="pay" className={`${card} space-y-3`}>
        <h2 id="pay" className="font-sans text-lg font-extrabold normal-case tracking-normal">
          {t("payments.title")}
        </h2>
        {pays.length === 0 ? (
          <p>{t("payments.empty")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th scope="col" className={th}>
                    {t("payments.date")}
                  </th>
                  <th scope="col" className={th}>
                    {t("payments.learner")}
                  </th>
                  <th scope="col" className={th}>
                    {t("payments.method")}
                  </th>
                  <th scope="col" className={th}>
                    {t("payments.amount")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-mist">
                {pays.slice(0, 10).map((p) => (
                  <tr key={p.id}>
                    <td className={td}>
                      {formatDate(fromTehranTime(p.paidOn, "12:00"), locale, {
                        weekday: false,
                        year: false,
                      })}
                    </td>
                    <td className={`${td} font-bold text-ocean`}>{name(p)}</td>
                    <td className={td}>
                      {t(`pay.methods.${p.method}`)}
                      {p.hasReceipt ? ` · ${t("payments.receipt")}` : ""}
                    </td>
                    <td className={`${td} font-bold`}>{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
