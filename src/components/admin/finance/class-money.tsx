import { getLocale, getTranslations } from "next-intl/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classPrices } from "@/db/schema";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatToman, fromTehranTime } from "@/lib/format";
import { learnerNames } from "@/lib/names";
import { priceOn } from "@/server/billing/pricing";
import { listInvoiceRows } from "@/server/billing/reports";
import { PriceForm } from "./forms";
import { StatusTag } from "./status-tag";

/** The class page's money card: a group's fee and who has paid, or a private class's price history. */
export async function ClassMoney({
  teacherId,
  cls,
}: {
  teacherId: string;
  cls: { id: string; type: "private" | "group"; priceToman: number; startsOn: string };
}) {
  const [t, locale] = await Promise.all([
    getTranslations("Admin.finance.classMoney"),
    getLocale() as Promise<Locale>,
  ]);
  const money = (n: number) => formatToman(n, locale);
  const card = "space-y-4 rounded-card border border-hairline bg-white p-6";
  const heading = "font-sans text-lg font-extrabold normal-case tracking-normal";

  if (cls.type === "group") {
    const rows = (await listInvoiceRows(teacherId, new Date())).filter(
      (r) => r.classId === cls.id && r.kind === "course" && r.status === "issued",
    );
    return (
      <section aria-labelledby="money" className={card}>
        <h2 id="money" className={heading}>
          {t("title")}
        </h2>
        <p>{t("groupLead", { fee: money(cls.priceToman) })}</p>
        <dl className="grid grid-cols-2 gap-3">
          <div>
            <dt className="text-sm font-bold">{t("received")}</dt>
            <dd className="font-extrabold text-ocean">
              {money(rows.reduce((n, r) => n + r.paid, 0))}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-bold">{t("left")}</dt>
            <dd className="font-extrabold text-ocean">
              {money(rows.reduce((n, r) => n + r.left, 0))}
            </dd>
          </div>
        </dl>
        <ul className="divide-y divide-mist">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/admin/finance/invoices/${r.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5"
              >
                <b className="text-ocean">{learnerNames(r, locale).primary}</b>
                <StatusTag state={r.state} partial={r.partial} />
                <span>{r.left ? t("owes", { left: money(r.left) }) : t("full")}</span>
              </Link>
            </li>
          ))}
        </ul>
        <p className="text-sm">{t("feeHint")}</p>
      </section>
    );
  }

  const changes = await db
    .select()
    .from(classPrices)
    .where(eq(classPrices.classId, cls.id))
    .orderBy(classPrices.effectiveFrom);
  const history = [{ effectiveFrom: cls.startsOn, priceToman: cls.priceToman }, ...changes];
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Tehran" });
  const current = priceOn(cls.priceToman, changes, today);
  return (
    <section aria-labelledby="money" className={card}>
      <h2 id="money" className={heading}>
        {t("title")}
      </h2>
      <p>{t("privateLead")}</p>
      <ul className="divide-y divide-mist">
        {history.map((h) => (
          <li
            key={h.effectiveFrom}
            className="flex flex-wrap items-center justify-between gap-2 py-2.5"
          >
            <b className="text-ocean">{money(h.priceToman)}</b>
            <span className="text-sm">
              {t("from", { date: formatDate(fromTehranTime(h.effectiveFrom, "12:00"), locale) })}
            </span>
            {h.priceToman === current && h.effectiveFrom <= today && (
              <span className="rounded-pill bg-mist px-2.5 text-sm font-bold text-brand">
                {t("now")}
              </span>
            )}
          </li>
        ))}
      </ul>
      <PriceForm classId={cls.id} current={money(current)} />
    </section>
  );
}
