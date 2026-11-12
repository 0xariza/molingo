import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { z } from "zod";
import { ReceiptDecision } from "@/components/admin/finance/forms";
import { BackLink } from "@/components/admin/learners/back-link";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { db } from "@/db";
import { invoices, receipts, students } from "@/db/schema";
import { formatDate, formatToman } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { invoiceDetail } from "@/server/billing/detail";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.finance.receipts");
  return { title: t("title") };
}

export default function ReceiptsPage({
  searchParams,
}: PageProps<"/[locale]/admin/finance/receipts">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Receipts searchParams={searchParams} />
    </Suspense>
  );
}

const STATUSES = ["pending", "approved", "rejected"] as const;

async function Receipts({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { teacherId } = await requireTeacher();
  const params = await searchParams;
  const [t, locale] = await Promise.all([
    getTranslations("Admin.finance.receipts"),
    getLocale() as Promise<Locale>,
  ]);
  const all = await db
    .select({
      id: receipts.id,
      status: receipts.status,
      amount: receipts.amountToman,
      createdAt: receipts.createdAt,
      invoiceId: receipts.invoiceId,
      fileId: receipts.fileId,
      cardLast4: receipts.cardLast4,
      fullNameFa: students.fullNameFa,
      fullNameEn: students.fullNameEn,
      studentId: receipts.studentId,
    })
    .from(receipts)
    .innerJoin(students, eq(students.id, receipts.studentId))
    .innerJoin(invoices, eq(invoices.id, receipts.invoiceId))
    .where(eq(receipts.teacherId, teacherId))
    .orderBy(desc(receipts.createdAt));
  const wanted = z.uuid().safeParse(params.id);
  const picked = wanted.success ? all.find((r) => r.id === wanted.data) : undefined;
  const tab = picked?.status ?? STATUSES.find((s) => s === params.tab) ?? "pending";
  const list = all.filter((r) => r.status === tab);
  const cur = picked ?? list[0];
  const detail = cur && (await invoiceDetail(cur.invoiceId, { teacherId }, new Date()));
  const money = (n: number) => formatToman(n, locale);

  return (
    <div className="space-y-5">
      <BackLink href="/admin/finance" label={t("back")} />
      <header>
        <h1 className="text-4xl sm:text-5xl">{t("title")}</h1>
        <p className="mt-1">{t("lead")}</p>
      </header>
      <nav aria-label={t("title")} className="flex flex-wrap gap-1">
        {STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/finance/receipts?tab=${s}`}
            aria-current={s === tab ? "page" : undefined}
            className="min-h-touch rounded-pill px-4 py-2 font-bold text-brand aria-[current=page]:bg-ocean aria-[current=page]:text-white"
          >
            {t(`tabs.${s}`)}{" "}
            <span className="text-sm">{all.filter((r) => r.status === s).length}</span>
          </Link>
        ))}
      </nav>
      {list.length === 0 && <p>{t("empty")}</p>}
      {cur && (
        <div className="grid items-start gap-5 lg:grid-cols-[18rem_1fr]">
          <ul className="divide-y divide-mist rounded-card border border-hairline bg-white">
            {list.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/finance/receipts?id=${r.id}`}
                  aria-current={r.id === cur.id ? "true" : undefined}
                  className="block px-4 py-3 aria-[current=true]:bg-surface"
                >
                  <b className="block text-ocean">{learnerNames(r, locale).primary}</b>
                  <span className="text-sm">
                    {money(r.amount)} ·{" "}
                    {formatDate(r.createdAt, locale, { weekday: false, year: false })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <section
            aria-label={t("detail")}
            className="space-y-4 rounded-card border border-hairline bg-white p-6"
          >
            <h2 className="font-sans text-lg font-extrabold normal-case tracking-normal">
              {learnerNames(cur, locale).primary}
            </h2>
            {/* eslint-disable-next-line @next/next/no-img-element -- the file route is private and not optimisable */}
            <img
              src={`/api/files/${cur.fileId}`}
              alt={t("photo")}
              className="max-h-96 w-full rounded-2xl bg-mist object-contain"
            />
            <dl className="grid grid-cols-[auto_1fr] gap-x-5 gap-y-2">
              <dt>{t("written")}</dt>
              <dd className="font-bold text-ocean">{money(cur.amount)}</dd>
              {detail && (
                <>
                  <dt>{t("invoiceLeft")}</dt>
                  <dd className="font-bold text-ocean">{money(detail.row.left)}</dd>
                </>
              )}
              <dt>{t("card")}</dt>
              <dd className="font-bold text-ocean" dir="ltr">
                {cur.cardLast4 ? `•••• ${cur.cardLast4}` : "—"}
              </dd>
            </dl>
            {detail && (
              <p className="text-sm">
                {detail.row.left === cur.amount ? t("matches") : t("differs")}{" "}
                <Link
                  href={`/admin/finance/invoices/${cur.invoiceId}`}
                  className="font-bold text-brand hover:underline"
                >
                  {t("openInvoice")}
                </Link>
              </p>
            )}
            {cur.status === "pending" ? (
              <ReceiptDecision id={cur.id} amount={cur.amount} />
            ) : (
              <p className="font-bold text-ocean">{t(`tabs.${cur.status}`)}</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
