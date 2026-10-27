import { UsersThree } from "@phosphor-icons/react/dist/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { connection } from "next/server";
import { scheduleText } from "@/components/admin/classes/schedule-text";
import type { Locale } from "@/i18n/routing";
import { formatDate, fromTehranTime } from "@/lib/format";
import { classTitle } from "@/lib/names";
import { listFormingGroups } from "@/server/classes/classes";

/** Mona's open public groups with free seats; the "groups are forming" note when there are none. */
export async function FormingGroups({
  teacherId,
  teacher,
}: {
  teacherId: string;
  teacher: string;
}) {
  await connection(); // seats change as people join
  const [t, tc, locale, groups] = await Promise.all([
    getTranslations("Landing.formats.group"),
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
    listFormingGroups(teacherId),
  ]);
  if (groups.length === 0)
    return <FormingEmpty title={t("emptyTitle")} body={t("emptyBody", { teacher })} />;
  const days = tc.raw("weekdaysShort") as string[];

  return (
    <div className="mt-auto space-y-2">
      <h4 className="font-extrabold text-ocean">{t("formingTitle")}</h4>
      <ul className="space-y-2">
        {groups.map((g) => (
          <li key={g.id} className="flex items-center gap-3 rounded-card bg-surface px-4 py-3">
            <span dir="ltr" className="shrink-0 font-['Lexend'] font-bold text-cinnamon-ink">
              {g.level}
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="block font-bold text-ocean">{classTitle(g, locale)}</span>
              <span className="text-sm">
                {scheduleText(g.slots, days, tc("and"), locale)} ·{" "}
                {t("startsOn", {
                  date: formatDate(fromTehranTime(g.startsOn, "12:00"), locale, { year: false }),
                })}
              </span>
            </span>
            <span className="shrink-0 rounded-pill bg-[#ddf5e8] px-2.5 text-sm font-bold text-[#14613a]">
              {t("seatsLeft", { count: g.free })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FormingEmpty({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-auto flex items-start gap-4 rounded-card bg-surface p-5">
      <UsersThree aria-hidden size={36} weight="duotone" className="shrink-0 text-teal" />
      <div>
        <h4 className="font-extrabold text-ocean">{title}</h4>
        <p className="mt-1 text-sm">{body}</p>
      </div>
    </div>
  );
}
