import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { StatusTag } from "@/components/admin/finance/status-tag";
import {
  AdjustmentForm,
  IssueOneForm,
  PaymentForm,
  VoidForm,
} from "@/components/admin/finance/forms";
import { BackLink } from "@/components/admin/learners/back-link";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatToman, fromTehranTime } from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import { requireTeacher } from "@/server/auth/current";
import { removeAdjustmentAction, remindAction, setExemptAction } from "@/server/billing/actions";
import { invoiceDetail } from "@/server/billing/detail";
import { jalaliMonthLabel } from "@/server/billing/pricing";
import { buttonClass } from "@/components/ui/button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Admin.finance.detail");
  return { title: t("title") };
}

export default function InvoicePage({
  params,
}: PageProps<"/[locale]/admin/finance/invoices/[id]">) {
  return (
    <Suspense
      fallback={<div aria-hidden="true" className="h-96 animate-pulse rounded-card bg-mist" />}
    >
      <Invoice params={params} />
    </Suspense>
  );
}

const card = "space-y-3 rounded-card border border-hairline bg-white p-6";
const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

async function Invoice({ params }: { params: Promise<{ id: string }> }) {
  const { teacherId } = await requireTeacher();
  const id = z.uuid().safeParse((await params).id);
  const d = id.success ? await invoiceDetail(id.data, { teacherId }, new Date()) : null;
  if (!d) notFound();
  const [t, locale] = await Promise.all([
    getTranslations("Admin.finance.detail"),
    getLocale() as Promise<Locale>,
  ]);
  const money = (n: number) => formatToman(n, locale);
  const day = (date: Date) => formatDate(date, locale, { year: false });
  const r = d.row;
  const editable = r.status !== "void";
  const sessionsCount = d.lines.filter((l) => l.kind === "session").length;
  const adjust = d.lines.filter((l) => l.kind === "adjustment");
  const credit = d.lines.filter((l) => l.kind === "credit").reduce((n, l) => n + l.amount, 0);

  return (
    <div className="space-y-5">
      <BackLink href="/admin/finance/invoices" label={t("back")} />
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">
            {r.period
              ? t("monthly", {
                  month: jalaliMonthLabel(r.period, locale),
                  number: formatNumber(r.number, locale),
                })
              : t("course", { number: formatNumber(r.number, locale) })}
          </h1>
          <p className="mt-1">
            <Link
              href={`/admin/students/${r.studentId}`}
              className="font-bold text-ocean hover:underline"
            >
              {learnerNames(r, locale).primary}
            </Link>
            {" · "}
            {classTitle({ nameFa: r.classFa, nameEn: r.classEn }, locale)}
          </p>
        </div>
        <StatusTag state={r.state} partial={r.partial} />
      </header>

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <section aria-labelledby="lines" className={card}>
            <h2 id="lines" className={heading}>
              {r.period ? t("sessions") : t("fee")}
            </h2>
            {r.period && <p className="text-sm">{t("sessionsLead")}</p>}
            <ul className="divide-y divide-mist">
              {d.lines
                .filter((l) => l.kind === "session" || l.kind === "course_fee")
                .map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-2.5">
                    <span className="min-w-0 flex-1 font-bold text-ocean">
                      {l.startsAt ? day(l.startsAt) : t("courseFee")}
                    </span>
                    <span>{money(l.amount)}</span>
                    {l.sessionId && editable && (
                      <form action={setExemptAction}>
                        <input type="hidden" name="invoiceId" value={r.id} />
                        <input type="hidden" name="sessionId" value={l.sessionId} />
                        <input type="hidden" name="exempt" value="on" />
                        <button className={buttonClass("quiet", "min-h-10 px-3 text-sm")}>
                          {t("dontCharge")}
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              {d.skipped.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-2.5 text-body">
                  <span className="min-w-0 flex-1 line-through">{day(s.startsAt)}</span>
                  <span className="text-sm">{t(`why.${s.why}`)}</span>
                  {s.why === "exempt" && editable && (
                    <form action={setExemptAction}>
                      <input type="hidden" name="invoiceId" value={r.id} />
                      <input type="hidden" name="sessionId" value={s.id} />
                      <button className={buttonClass("quiet", "min-h-10 px-3 text-sm")}>
                        {t("chargeAgain")}
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
            {adjust.map((l) => (
              <div key={l.id} className="flex items-center gap-3 border-t border-mist pt-2.5">
                <span className="min-w-0 flex-1">
                  <b className="text-ocean">{l.description}</b>{" "}
                  <span className="text-sm">{t("adjustment")}</span>
                </span>
                <span>{money(l.amount)}</span>
                {editable && (
                  <form action={removeAdjustmentAction}>
                    <input type="hidden" name="invoiceId" value={r.id} />
                    <input type="hidden" name="lineId" value={l.id} />
                    <button className={buttonClass("quiet", "min-h-10 px-3 text-sm")}>
                      {t("remove")}
                    </button>
                  </form>
                )}
              </div>
            ))}
            {credit !== 0 && (
              <div className="flex items-center gap-3 border-t border-mist pt-2.5">
                <span className="min-w-0 flex-1 font-bold text-ocean">{t("creditLine")}</span>
                <span>{money(credit)}</span>
              </div>
            )}
          </section>
          {editable && <AdjustmentForm invoiceId={r.id} />}

          <section aria-labelledby="hist" className={card}>
            <h2 id="hist" className={heading}>
              {t("history")}
            </h2>
            {d.payments.length + d.receipts.length === 0 && <p>{t("noHistory")}</p>}
            <ul className="divide-y divide-mist">
              {d.payments.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-2.5">
                  <span>
                    {formatDate(fromTehranTime(p.paidOn, "12:00"), locale, { year: false })} ·{" "}
                    {t("paymentOf")}
                  </span>
                  <b className="text-[#1f7a4d]">{money(p.amount)}</b>
                </li>
              ))}
              {d.receipts
                .filter((x) => x.status !== "approved")
                .map((x) => (
                  <li key={x.id} className="flex justify-between gap-3 py-2.5">
                    <Link
                      href={`/admin/finance/receipts?id=${x.id}`}
                      className="font-bold text-brand hover:underline"
                    >
                      {t(`receipt.${x.status}`)}
                    </Link>
                    <span>{money(x.amount)}</span>
                  </li>
                ))}
            </ul>
          </section>
        </div>

        <aside className={`${card} lg:sticky lg:top-6`} aria-labelledby="sum">
          <h2 id="sum" className={heading}>
            {t("summary")}
          </h2>
          <dl className="space-y-2">
            {r.period && (
              <div className="flex justify-between">
                <dt>{t("count")}</dt>
                <dd className="font-bold text-ocean">{formatNumber(sessionsCount, locale)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt>{t("total")}</dt>
              <dd className="font-bold text-ocean">{money(r.total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt>{t("paid")}</dt>
              <dd className="font-bold text-[#1f7a4d]">{money(r.paid)}</dd>
            </div>
            <div className="flex justify-between border-t border-mist pt-2 text-lg">
              <dt className="font-bold">{t("left")}</dt>
              <dd className="font-extrabold text-ocean">{money(r.left)}</dd>
            </div>
            {r.dueOn && (
              <div className="flex justify-between text-sm">
                <dt>{t("due")}</dt>
                <dd>{formatDate(fromTehranTime(r.dueOn, "12:00"), locale, { year: false })}</dd>
              </div>
            )}
          </dl>
          {r.state === "draft" && <IssueOneForm id={r.id} />}
          {r.status === "issued" && r.left > 0 && (
            <PaymentForm
              studentId={r.studentId}
              studentName={learnerNames(r, locale).primary}
              invoiceId={r.id}
              left={money(r.left)}
            />
          )}
          {r.state === "overdue" && (
            <form action={remindAction}>
              <input type="hidden" name="id" value={r.id} />
              <button className={buttonClass("ghost", "w-full")}>{t("remind")}</button>
            </form>
          )}
          {editable && r.paid === 0 && <VoidForm id={r.id} />}
          {r.state === "paid" && <p className="font-bold text-[#1f7a4d]">{t("allPaid")}</p>}
        </aside>
      </div>
    </div>
  );
}
