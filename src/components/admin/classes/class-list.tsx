import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatNumber } from "@/lib/format";
import { classTitle } from "@/lib/names";
import type { ClassCard, ClassState } from "@/server/classes/classes";
import { AddLearnerButton } from "./add-learner-button";
import type { Candidate } from "./learner-picker-items";
import { scheduleText } from "./schedule-text";

export type ClassFilter = "running" | "full" | "finished" | "archived";
export const classFilters: ClassFilter[] = ["running", "full", "finished", "archived"];

const inFilter = (c: ClassCard, f: ClassFilter) =>
  f === "running" ? c.state === "open" || c.state === "full" : c.state === f;

const stateTone: Record<ClassState, string> = {
  open: "bg-[#ddf5e8] text-[#14613a]",
  full: "bg-[#fcefd3] text-[#8a520e]",
  finished: "bg-mist text-brand",
  archived: "bg-[#edf0f3] text-[#4a5866]",
};

/** Filter chips and the class cards. The whole card opens the class; the add button opens a picker. */
export async function ClassList({
  cards,
  filter,
  candidates,
}: {
  cards: ClassCard[];
  filter: ClassFilter;
  candidates: Candidate[];
}) {
  const [t, locale] = await Promise.all([
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
  ]);
  const n = (v: number) => formatNumber(v, locale);
  const days = t.raw("weekdaysShort") as string[];
  const shown = cards.filter((c) => inFilter(c, filter));

  return (
    <section aria-labelledby="class-list" className="space-y-4">
      <h2 id="class-list" className="sr-only">
        {t("title")}
      </h2>
      <nav aria-label={t("filters.label")} className="flex flex-wrap gap-2">
        {classFilters.map((f) => {
          const active = f === filter;
          return (
            <Link
              key={f}
              href={f === "running" ? "/admin/classes" : `/admin/classes?show=${f}`}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-touch items-center gap-2 rounded-pill border px-4 font-bold ${
                active
                  ? "border-ocean bg-ocean text-white"
                  : "border-line/50 bg-white hover:border-brand"
              }`}
            >
              {t(`filters.${f}`)}
              <span className="font-semibold opacity-75">
                {n(cards.filter((c) => inFilter(c, f)).length)}
              </span>
            </Link>
          );
        })}
      </nav>

      {shown.length === 0 ? (
        <p className="rounded-card border border-hairline bg-white p-6">
          {cards.length === 0 ? t("empty") : t("noMatch")}
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {shown.map((c) => {
            const free = c.capacity - c.taken;
            const canAdd = c.state === "open";
            return (
              <li
                key={c.id}
                className="relative flex flex-col gap-3 rounded-card border border-hairline bg-white p-5 transition hover:border-brand focus-within:ring-4 focus-within:ring-brand/20"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span
                      dir="ltr"
                      className="grid h-7 min-w-9 place-items-center rounded-lg bg-ocean px-1.5 text-sm font-extrabold text-white"
                    >
                      {c.level}
                    </span>
                    <Link
                      href={`/admin/classes/${c.id}`}
                      className="truncate text-lg font-extrabold text-ocean outline-none after:absolute after:inset-0 after:rounded-card after:content-['']"
                    >
                      {classTitle(c, locale)}
                    </Link>
                  </div>
                  <span
                    className={`shrink-0 rounded-pill px-2.5 py-0.5 text-sm font-bold ${stateTone[c.state]}`}
                  >
                    {t(`state.${c.state}`)}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-sm font-bold">
                  <span className="rounded-pill bg-mist px-2.5 text-brand">
                    {t(`type.${c.type}`)}
                  </span>
                  <span className="rounded-pill bg-mist px-2.5 text-brand">
                    {scheduleText(c.slots, days, t("and"), locale)}
                  </span>
                  {c.isPublic && (
                    <span className="rounded-pill bg-[#ddf5e8] px-2.5 text-[#14613a]">
                      {t("card.onLanding")}
                    </span>
                  )}
                </div>
                <div aria-hidden="true" className="flex gap-1">
                  {Array.from({ length: c.capacity }, (_, i) => (
                    <span
                      key={i}
                      className={`h-2.5 flex-1 rounded-sm ${i < c.taken ? "bg-brand" : "bg-mist"}`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    <strong className="text-ocean">
                      {t("card.seats", { taken: n(c.taken), capacity: n(c.capacity) })}
                    </strong>
                  </span>
                  {c.state === "open" || c.state === "full" ? (
                    <span className={free ? "" : "font-bold text-[#8a520e]"}>
                      {free ? t("card.free", { count: free }) : t("card.noFree")}
                    </span>
                  ) : null}
                </div>
                {(c.state === "open" || c.state === "full") && (
                  <div className="flex items-center border-t border-mist pt-3">
                    {canAdd ? (
                      <AddLearnerButton
                        classId={c.id}
                        className={classTitle(c, locale)}
                        candidates={candidates}
                        inClass={c.learnerIds}
                      />
                    ) : (
                      <span className="rounded-pill bg-[#edf0f3] px-3.5 py-2 text-sm font-bold text-body/80">
                        {t("card.classFull")}
                      </span>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
