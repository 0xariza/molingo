import { getLocale, getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { learnerClasses } from "@/server/classes/stats";

/** The learner's classes on their profile: current places first, then ended ones. */
export async function LearnerClasses({
  teacherId,
  studentId,
}: {
  teacherId: string;
  studentId: string;
}) {
  const [t, tc, locale, rows] = await Promise.all([
    getTranslations("Admin.learners.classes"),
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
    learnerClasses(teacherId, studentId),
  ]);
  const date = (d: Date) => formatDate(d, locale, { weekday: false });

  return (
    <section
      aria-labelledby="classes-title"
      className="space-y-3 rounded-card border border-hairline bg-white p-6"
    >
      <div className="flex items-center justify-between gap-2">
        <h2
          id="classes-title"
          className="font-sans text-lg font-extrabold normal-case tracking-normal"
        >
          {t("title")}
        </h2>
        <Link href="/admin/classes" className={buttonClass("ghost", "min-h-10 px-4 text-sm")}>
          {t("add")}
        </Link>
      </div>
      {rows.length === 0 ? (
        <p>{t("none")}</p>
      ) : (
        <ul className="divide-y divide-mist">
          {rows.map((r) => (
            <li key={`${r.classId}-${r.startedAt.toISOString()}`}>
              <Link
                href={`/admin/classes/${r.classId}`}
                className="flex items-center gap-3 py-3 hover:bg-surface"
              >
                <span
                  dir="ltr"
                  className="grid size-10 shrink-0 place-items-center rounded-xl bg-ocean text-sm font-extrabold text-white"
                >
                  {r.level}
                </span>
                <span className="min-w-0 flex-1 leading-snug">
                  <span className="block font-bold text-ocean">{classTitle(r, locale)}</span>
                  <span className="text-sm">
                    {tc(`type.${r.type}`)} ·{" "}
                    {r.status === "active"
                      ? t("since", { date: date(r.startedAt) })
                      : t("endedOn", { date: date(r.endedAt!) })}
                  </span>
                </span>
                <span
                  className={`rounded-pill px-2.5 py-0.5 text-sm font-bold ${
                    r.status === "active"
                      ? "bg-[#ddf5e8] text-[#14613a]"
                      : "bg-[#edf0f3] text-[#4a5866]"
                  }`}
                >
                  {r.status === "active" ? t("inClass") : t("ended")}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
