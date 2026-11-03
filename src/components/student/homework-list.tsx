import { CaretRight } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatTime, tehranDateKey } from "@/lib/format";
import { classTitle } from "@/lib/names";
import type { LearnerHomework } from "@/server/homework/submissions";

const DAY = 24 * 60 * 60 * 1000;
const daysBetween = (from: Date, to: Date) =>
  Math.round((Date.parse(tehranDateKey(to)) - Date.parse(tehranDateKey(from))) / DAY);

/** Where a piece of homework stands for the learner, as a label and whether it is urgent. */
export async function homeworkBadge(h: LearnerHomework, now: Date) {
  const t = await getTranslations("Student.homework");
  if (h.status === "needs_revision") return { label: t("needsRevision"), urgent: true };
  if (h.status === "submitted") return { label: t("submitted"), urgent: false };
  if (h.status === "reviewed") return { label: t("reviewed"), urgent: false };
  if (!h.dueAt) return { label: t("noDue"), urgent: false };
  if (h.dueAt < now) return { label: t("overdue"), urgent: true };
  const days = daysBetween(now, h.dueAt);
  return days === 0
    ? { label: t("dueToday"), urgent: true }
    : { label: t("dueIn", { count: days }), urgent: false };
}

/** A list of the learner's homework; each opens its page. */
export async function HomeworkList({
  items,
  now,
  locale,
  empty,
}: {
  items: LearnerHomework[];
  now: Date;
  locale: Locale;
  empty: string;
}) {
  const t = await getTranslations("Student.homework");
  if (items.length === 0)
    return <p className="rounded-card border border-hairline bg-white p-6">{empty}</p>;
  const badges = await Promise.all(items.map((h) => homeworkBadge(h, now)));
  return (
    <ul className="space-y-3">
      {items.map((h, i) => {
        const teacher = locale === "en" ? h.teacherNameEn : h.teacherNameFa;
        const cls = classTitle({ nameFa: h.classNameFa, nameEn: h.classNameEn }, locale);
        return (
          <li key={h.id}>
            <Link
              href={`/app/homework/${h.id}`}
              className="flex items-center gap-3 rounded-card border border-hairline bg-white p-4 hover:border-brand"
            >
              <span className="min-w-0 flex-1 space-y-1">
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-extrabold text-ocean">{h.title}</span>
                  <span
                    className={`rounded-pill px-2.5 py-0.5 text-sm font-bold ${
                      badges[i].urgent ? "bg-[#fcefd3] text-[#8a520e]" : "bg-mist text-brand"
                    }`}
                  >
                    {badges[i].label}
                  </span>
                </span>
                <span className="block text-sm">
                  {h.status === "needs_revision" && h.feedback
                    ? t("teacherSays", { teacher, feedback: h.feedback })
                    : h.status === "reviewed"
                      ? `${cls} · ${t("hasFeedback")}`
                      : `${cls} · ${
                          h.dueAt
                            ? t("due", {
                                date: `${formatDate(h.dueAt, locale, { year: false })} · ${formatTime(h.dueAt, locale)}`,
                              })
                            : t("noDue")
                        }`}
                </span>
              </span>
              <CaretRight aria-hidden size={18} className="icon-directional shrink-0 text-body" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
