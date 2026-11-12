import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { db } from "@/db";
import { formatDate, formatToman, fromTehranTime } from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import { creditBalance } from "@/server/billing/invoices";
import { jalaliMonthLabel } from "@/server/billing/pricing";
import { listInvoiceRows, listPayments } from "@/server/billing/reports";
import { PaymentForm } from "./forms";
import { StatusTag } from "./status-tag";

/** A learner's money with this teacher: what they owe, their credit, and every invoice and payment. */
export async function LearnerAccount({
  teacherId,
  learner,
}: {
  teacherId: string;
  learner: { id: string; fullNameFa: string; fullNameEn: string | null };
}) {
  const [t, locale] = await Promise.all([
    getTranslations("Admin.finance.account"),
    getLocale() as Promise<Locale>,
  ]);
  const [rows, pays, credit] = await Promise.all([
    listInvoiceRows(teacherId, new Date(), { studentId: learner.id }),
    listPayments(teacherId, learner.id),
    creditBalance(db, learner.id),
  ]);
  const money = (n: number) => formatToman(n, locale);
  const issued = rows.filter((r) => r.status === "issued");
  const due = issued.reduce((n, r) => n + r.left, 0);
  const open = issued.filter((r) => r.left > 0);
  const label = (r: (typeof rows)[number]) =>
    r.period
      ? t("monthly", { month: jalaliMonthLabel(r.period, locale) })
      : t("course", { name: classTitle({ nameFa: r.classFa, nameEn: r.classEn }, locale) });

  return (
    <section
      aria-labelledby="account-title"
      className="space-y-4 rounded-card border border-hairline bg-white p-6"
    >
      <h2
        id="account-title"
        className="font-sans text-lg font-extrabold normal-case tracking-normal"
      >
        {t("title")}
      </h2>
      <dl className="grid grid-cols-3 gap-3">
        <div>
          <dt className="text-sm font-bold">{t("due")}</dt>
          <dd className={`font-extrabold ${due ? "text-red-700" : "text-ocean"}`}>{money(due)}</dd>
        </div>
        <div>
          <dt className="text-sm font-bold">{t("credit")}</dt>
          <dd className="font-extrabold text-ocean">{money(credit)}</dd>
        </div>
        <div>
          <dt className="text-sm font-bold">{t("paidAll")}</dt>
          <dd className="font-extrabold text-ocean">
            {money(pays.reduce((n, p) => n + p.amount, 0))}
          </dd>
        </div>
      </dl>
      <PaymentForm
        studentId={learner.id}
        studentName={learnerNames(learner, locale).primary}
        options={open.map((r) => ({ value: r.id, label: `${label(r)} · ${money(r.left)}` }))}
      />
      <h3 className="font-bold text-ocean">{t("invoices")}</h3>
      {rows.length === 0 ? (
        <p>{t("none")}</p>
      ) : (
        <ul className="divide-y divide-mist">
          {rows
            .filter((r) => r.state !== "void")
            .map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/finance/invoices/${r.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-2.5"
                >
                  <span className="font-bold text-ocean">{label(r)}</span>
                  <StatusTag state={r.state} partial={r.partial} />
                  <b>{money(r.total)}</b>
                </Link>
              </li>
            ))}
        </ul>
      )}
      <h3 className="font-bold text-ocean">{t("payments")}</h3>
      {pays.length === 0 ? (
        <p>{t("noPayments")}</p>
      ) : (
        <ul className="divide-y divide-mist">
          {pays.map((p) => (
            <li key={p.id} className="flex justify-between gap-3 py-2.5">
              <span>{formatDate(fromTehranTime(p.paidOn, "12:00"), locale, { year: false })}</span>
              <b className="text-[#1f7a4d]">{money(p.amount)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
