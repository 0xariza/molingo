import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { StatusTag } from "@/components/admin/finance/status-tag";
import { CopyCard } from "@/components/student/bills/copy-card";
import { ReceiptForm } from "@/components/student/bills/receipt-form";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatToman, fromTehranTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { requireStudent } from "@/server/auth/current";
import { learnerBill } from "@/server/billing/learner";
import { jalaliMonthLabel } from "@/server/billing/pricing";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Student.bills");
  return { title: t("title") };
}

export default function BillPage({ params }: PageProps<"/[locale]/app/bills/[id]">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-64 animate-pulse rounded-card bg-mist" />}
    >
      <Bill params={params} />
    </Suspense>
  );
}

const card = "space-y-3 rounded-card border border-hairline bg-white p-5";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

async function Bill({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStudent();
  const id = z.uuid().safeParse((await params).id);
  const d = id.success ? await learnerBill(user.id, id.data) : null;
  if (!d) notFound();
  const [t, locale] = await Promise.all([
    getTranslations("Student.bills"),
    getLocale() as Promise<Locale>,
  ]);
  const money = (n: number) => formatToman(n, locale);
  const r = d.row;
  const waiting = d.receipts.find((x) => x.status === "pending");
  const refused =
    !waiting && d.receipts.at(-1)?.status === "rejected" ? d.receipts.at(-1) : undefined;
  const sessionLines = d.lines.filter((l) => l.kind === "session");
  const others = d.lines.filter((l) => l.kind !== "session");

  return (
    <div className="space-y-5">
      <Link
        href="/app/bills"
        className="inline-flex min-h-touch items-center font-bold text-brand hover:underline"
      >
        {t("back")}
      </Link>
      <header className="space-y-1">
        {waiting && r.left > 0 ? (
          <span className="inline-flex rounded-pill bg-[#fdf3dc] px-3 py-0.5 text-sm font-bold text-[#6b4e00]">
            {t("receiptPending")}
          </span>
        ) : (
          <StatusTag state={r.state} partial={r.partial} />
        )}
        <h1 className="text-3xl sm:text-4xl">
          {r.period
            ? t("monthlyTitle", { month: jalaliMonthLabel(r.period, locale) })
            : t("courseTitle")}
        </h1>
        <p>{t("from", { name: classTitle({ nameFa: r.classFa, nameEn: r.classEn }, locale) })}</p>
      </header>

      <section aria-labelledby="sum" className={card}>
        <h2 id="sum" className={heading}>
          {t("summary")}
        </h2>
        {others.map((l) => (
          <div key={l.id} className="flex justify-between">
            <span>
              {l.kind === "credit"
                ? t("creditLine")
                : l.kind === "course_fee"
                  ? t("courseFee")
                  : l.description}
            </span>
            <b className="text-ocean">{money(l.amount)}</b>
          </div>
        ))}
        {sessionLines.length > 0 && (
          <div className="flex justify-between">
            <span>{t("sessions", { count: sessionLines.length })}</span>
            <b className="text-ocean">{money(sessionLines.reduce((n, l) => n + l.amount, 0))}</b>
          </div>
        )}
        <div className="flex justify-between border-t border-mist pt-2 text-lg">
          <b>{t("total")}</b>
          <b className="text-ocean">{money(r.total)}</b>
        </div>
        {r.paid > 0 && (
          <div className="flex justify-between">
            <span>{t("paid")}</span>
            <b className="text-[#1f7a4d]">{money(r.paid)}</b>
          </div>
        )}
        {r.left > 0 && r.dueOn && (
          <p className="text-sm">
            {t("deadline", { date: formatDate(fromTehranTime(r.dueOn, "12:00"), locale) })}
          </p>
        )}
        {sessionLines.length > 0 && (
          <details>
            <summary className="min-h-touch cursor-pointer py-2 font-bold text-brand">
              {t("seeSessions", { count: sessionLines.length })}
            </summary>
            <ul className="divide-y divide-mist">
              {sessionLines.map((l) => (
                <li key={l.id} className="flex justify-between py-2">
                  <span className="text-ocean">
                    {l.startsAt ? formatDate(l.startsAt, locale, { year: false }) : ""}
                  </span>
                  <span>{money(l.amount)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {r.left <= 0 && (
        <section className="rounded-card border border-[#b7dcc6] bg-[#f2faf5] p-5 font-bold text-[#1f7a4d]">
          {t("thanks")}
        </section>
      )}

      {waiting && r.left > 0 && (
        <section
          aria-live="polite"
          className="space-y-2 rounded-card border border-[#f2d48a] bg-[#fffaf0] p-5"
        >
          <b className="text-ocean">{t("sentTitle")}</b>
          <p className="text-sm">{t("sentLead")}</p>
          <p>
            <b className="text-ocean">{money(waiting.amount)}</b>
          </p>
        </section>
      )}

      {r.left > 0 && !waiting && (
        <>
          {refused && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
            >
              {t(`refused.${(refused.rejectReason ?? "amount") as "amount"}`)}
            </div>
          )}
          <section
            aria-labelledby="step1"
            className="space-y-3 rounded-card bg-ocean p-5 text-white"
          >
            <h2 id="step1" className={`${heading} text-white`}>
              {t("step1")}
            </h2>
            {d.card.number ? (
              <div className="space-y-2 [&_b]:text-white">
                {d.card.holder && (
                  <p className="text-sm text-room-cinnamon">
                    {t("holder", { name: d.card.holder })}
                  </p>
                )}
                <CopyCard number={d.card.number} />
                {d.card.sheba && (
                  <p dir="ltr" className="text-start text-sm">
                    {d.card.sheba}
                  </p>
                )}
              </div>
            ) : (
              <p>{t("noCard")}</p>
            )}
            <p className="text-sm">{t("step1Hint", { amount: money(r.left) })}</p>
          </section>
          {d.card.number && (
            <section aria-labelledby="step2" className={card}>
              <h2 id="step2" className={heading}>
                {t("step2")}
              </h2>
              <ReceiptForm invoiceId={r.id} left={r.left} />
            </section>
          )}
        </>
      )}
    </div>
  );
}
