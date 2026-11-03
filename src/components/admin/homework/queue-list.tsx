import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime } from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import type { QueueRow } from "@/server/homework/submissions";
import { answerChips } from "./answer-chips";

/** The answers in one status, oldest first; each opens its review page. */
export async function QueueList({ rows, empty }: { rows: QueueRow[]; empty: string }) {
  const [t, locale] = await Promise.all([
    getTranslations("Admin.homework.row"),
    getLocale() as Promise<Locale>,
  ]);
  if (rows.length === 0)
    return <p className="rounded-card border border-hairline bg-white p-6">{empty}</p>;
  return (
    <ul className="divide-y divide-mist overflow-hidden rounded-card border border-hairline bg-white">
      {rows.map((r) => {
        const person = learnerNames(r, locale).primary;
        return (
          <li key={r.id}>
            <Link
              href={`/admin/homework/${r.id}`}
              className="grid items-center gap-x-3 gap-y-1 px-5 py-4 hover:bg-surface sm:grid-cols-[2.5rem_2fr_1.6fr_1fr_auto]"
            >
              <span
                aria-hidden="true"
                className="hidden size-10 place-items-center rounded-full bg-mist font-extrabold text-brand sm:grid"
              >
                {person.slice(0, 1)}
              </span>
              <span className="leading-snug">
                <span className="block font-bold text-ocean">{person}</span>
                <span className="block text-sm">
                  {t("meta", {
                    title: r.title,
                    class: classTitle({ nameFa: r.classNameFa, nameEn: r.classNameEn }, locale),
                  })}
                </span>
              </span>
              <span className="flex flex-wrap gap-1.5 text-sm font-semibold">
                {answerChips(r.hasText, r.files).map((c) => (
                  <span
                    key={`${c.kind}-${c.ext ?? ""}`}
                    className="rounded-pill bg-surface px-2.5 py-0.5"
                  >
                    {c.kind === "file"
                      ? `${t("file")} · ${c.ext}`
                      : c.kind === "photo" && c.count > 1
                        ? t("photos", { count: formatNumber(c.count, locale) })
                        : t(c.kind)}
                  </span>
                ))}
              </span>
              <span className="text-sm">
                {formatDate(r.submittedAt, locale, { year: false })} ·{" "}
                {formatTime(r.submittedAt, locale)}
                {r.late && <span className="font-bold text-[#a64916]"> · {t("late")}</span>}
                {r.revision > 1 && <span> · {t("revision", { n: r.revision })}</span>}
              </span>
              <span className="inline-flex items-center gap-1 justify-self-end font-bold text-brand">
                {t("review")}
                <CaretRight aria-hidden size={18} className="icon-directional" />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
