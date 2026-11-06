import { MapTrifold } from "@phosphor-icons/react/dist/ssr";
import { getTranslations } from "next-intl/server";
import { buttonClass } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import type { getClassPath } from "@/server/paths/class-paths";

type ClassPath = NonNullable<Awaited<ReturnType<typeof getClassPath>>>;

/** The class page's path card: its stations with the sessions each gets, or "Add a path". */
export async function PathCard({
  classId,
  path,
  locale,
  editable,
}: {
  classId: string;
  path: ClassPath | null;
  locale: Locale;
  editable: boolean;
}) {
  const t = await getTranslations("Admin.paths");
  const n = (v: number) => formatNumber(v, locale);
  const href = `/admin/classes/${classId}/path`;
  if (!path)
    return (
      <section
        aria-labelledby="path-title"
        className="flex flex-wrap items-center gap-5 rounded-card border-[1.5px] border-dashed border-brand bg-white p-6"
      >
        <MapTrifold aria-hidden size={40} className="shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <h2
            id="path-title"
            className="font-sans text-lg font-extrabold normal-case tracking-normal"
          >
            {t("page.card")}
          </h2>
          <p className="text-sm">{t("page.cardEmpty")}</p>
        </div>
        {editable && (
          <Link href={href} className={buttonClass("primary")}>
            {t("page.add")}
          </Link>
        )}
      </section>
    );

  const taken = path.stations.filter((s) => s.included);
  return (
    <section
      aria-labelledby="path-title"
      className="space-y-4 rounded-card border border-hairline bg-white p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="path-title"
            className="font-sans text-lg font-extrabold normal-case tracking-normal"
          >
            {t("page.card")}
          </h2>
          <p className="text-sm">{t("page.from", { title: `\u2068${path.sourceTitle}\u2069` })}</p>
        </div>
        {editable && (
          <Link href={href} className={buttonClass("ghost", "min-h-10 px-4 text-sm")}>
            {t("page.edit")}
          </Link>
        )}
      </div>
      <ol className="space-y-1">
        {taken.map((s, i) => (
          <li
            key={s.pathStationId}
            className="flex flex-wrap items-center gap-3 rounded-xl bg-surface px-3 py-2"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-white text-sm font-extrabold text-brand">
              {n(i + 1)}
            </span>
            <span className="min-w-0 flex-1 font-bold text-ocean">
              {s.title}
              {s.custom && (
                <span className="ms-2 rounded-pill bg-cinnamon-soft px-2 text-xs text-cinnamon-ink">
                  {t("customTag")}
                </span>
              )}
            </span>
            {s.held > 0 && <span className="text-xs">{t("page.held", { n: n(s.held) })}</span>}
            <span className="text-sm font-bold text-ocean">
              {s.first === null
                ? t("nextCourse")
                : s.first === s.last
                  ? t("oneSession", { n: n(s.first) })
                  : t("sessions", { first: n(s.first), last: n(s.last!) })}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-body/80">{t("checkRule")}</p>
    </section>
  );
}
