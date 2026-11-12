import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { StatusTag } from "@/components/admin/finance/status-tag";
import { IssueForm } from "@/components/admin/finance/forms";
import { BackLink } from "@/components/admin/learners/back-link";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatToman } from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { jalaliMonthLabel } from "@/server/billing/pricing";
import { listInvoiceRows, type InvoiceRow } from "@/server/billing/reports";
import { runBillingSweep } from "@/server/billing/sweep";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.finance.invoices");
  return { title: t("title") };
}

export default function InvoicesPage({
  searchParams,
}: PageProps<"/[locale]/admin/finance/invoices">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Invoices searchParams={searchParams} />
    </Suspense>
  );
}

const TABS = ["draft", "open", "overdue", "paid", "all"] as const;
type Tab = (typeof TABS)[number];
const inTab: Record<Tab, (r: InvoiceRow) => boolean> = {
  draft: (r) => r.state === "draft",
  open: (r) => r.status === "issued" && r.left > 0,
  overdue: (r) => r.state === "overdue",
  paid: (r) => r.state === "paid",
  all: (r) => r.state !== "void",
};

async function Invoices({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  await runBillingSweep(teacherId);
  const raw = (await searchParams).tab;
  const rows = await listInvoiceRows(teacherId, new Date());
  const tab: Tab = TABS.find((x) => x === raw) ?? (rows.some(inTab.draft) ? "draft" : "open");
  const [t, locale] = await Promise.all([
    getTranslations("Admin.finance.invoices"),
    getLocale() as Promise<Locale>,
  ]);
  const money = (n: number) => formatToman(n, locale);
  const shown = rows.filter(inTab[tab]);
  const what = (r: InvoiceRow) =>
    r.period ? t("monthly", { month: jalaliMonthLabel(r.period, locale) }) : t("course");

  const list = (
    <ul className="divide-y divide-mist rounded-card border border-hairline bg-white">
      {shown.length === 0 && <li className="p-6">{t("empty")}</li>}
      {shown.map((r) => (
        <li key={r.id} className="flex items-center gap-3 px-4 py-3">
          {tab === "draft" && (
            <input
              type="checkbox"
              name="ids"
              value={r.id}
              defaultChecked
              aria-label={learnerNames(r, locale).primary}
              className="size-5 shrink-0"
            />
          )}
          <Link
            href={`/admin/finance/invoices/${r.id}`}
            className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1"
          >
            <span className="min-w-0 flex-1">
              <b className="block text-ocean">{learnerNames(r, locale).primary}</b>
              <span className="text-sm">
                {what(r)} · {classTitle({ nameFa: r.classFa, nameEn: r.classEn }, locale)}
              </span>
            </span>
            <StatusTag state={r.state} partial={r.partial} />
            <b className="text-ocean">{money(r.total)}</b>
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-5">
      <BackLink href="/admin/finance" label={t("back")} />
      <header>
        <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="mt-1">{t("lead")}</p>
      </header>
      <nav aria-label={t("title")} className="flex flex-wrap gap-1">
        {TABS.map((x) => (
          <Link
            key={x}
            href={`/admin/finance/invoices?tab=${x}`}
            aria-current={x === tab ? "page" : undefined}
            className="min-h-touch rounded-pill px-4 py-2 font-bold text-brand aria-[current=page]:bg-ocean aria-[current=page]:text-white"
          >
            {t(`tabs.${x}`)} <span className="text-sm">{rows.filter(inTab[x]).length}</span>
          </Link>
        ))}
      </nav>
      {tab === "draft" && shown.length > 0 ? (
        <IssueForm count={shown.length} total={money(shown.reduce((n, r) => n + r.total, 0))}>
          {list}
        </IssueForm>
      ) : (
        list
      )}
    </div>
  );
}
