import { ClipboardText, Play } from "@phosphor-icons/react/dist/ssr";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { formatDate, formatNumber, formatTime, tehranDateKey } from "@/lib/format";
import { classTitle, learnerNames } from "@/lib/names";
import type { DaySession, nextClassSession } from "@/server/classes/sessions";
import type { UpcomingSlot } from "@/server/funnel/level-check";

const card = "rounded-card border border-hairline bg-white";
const avatarTones = ["bg-whale", "bg-[#c7b8f5]", "bg-[#f5b8a0]"];

type NextClass = NonNullable<Awaited<ReturnType<typeof nextClassSession>>>;

/** The class on now or coming next: when, who, and the way into it. */
export async function NextClassCard({ next, now }: { next: NextClass | null; now: Date }) {
  const [t, tc, locale] = await Promise.all([
    getTranslations("Admin.home"),
    getTranslations("Admin.classes"),
    getLocale() as Promise<Locale>,
  ]);
  if (!next) {
    return (
      <section className={`${card} p-6`}>
        <p>{t("noNext")}</p>
      </section>
    );
  }
  const minutes = Math.round((next.startsAt.getTime() - now.getTime()) / 60_000);
  const sameDay = tehranDateKey(next.startsAt) === tehranDateKey(now);
  const badge =
    next.phase === "live"
      ? t("nextLive")
      : sameDay && minutes <= 120
        ? t("nextSoon", { minutes: formatNumber(minutes, locale) })
        : t("nextLater", {
            when: `${formatDate(next.startsAt, locale, { year: false })} ${formatTime(next.startsAt, locale)}`,
          });
  const shown = next.learners.slice(0, 3);
  const extra = next.learners.length - shown.length;

  return (
    <section
      aria-labelledby="next-class"
      className={`${card} flex flex-wrap items-center gap-6 p-6 sm:p-7`}
    >
      <div className="flex min-w-72 flex-1 flex-col gap-2">
        <span
          className={`self-start rounded-pill px-3 py-0.5 text-sm font-extrabold ${
            next.phase === "live" ? "bg-ocean text-white" : "bg-sand text-ocean"
          }`}
        >
          {badge}
        </span>
        <h2 id="next-class" className="text-[2.125rem] leading-snug">
          {classTitle(next, locale)}{" "}
          <bdi dir="ltr" className="font-bold text-brand">
            {next.level}
          </bdi>
        </h2>
        <p>
          {t("nextLine", {
            from: formatTime(next.startsAt, locale),
            to: formatTime(next.endsAt, locale),
            type: next.kind === "makeup" ? tc("detail.makeup") : tc(`type.${next.type}`),
          })}
        </p>
      </div>
      {shown.length > 0 && (
        <div
          className="flex items-center"
          aria-label={next.learners.map((l) => learnerNames(l, locale).primary).join("، ")}
        >
          {shown.map((l, i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`-ms-2.5 grid size-10 place-items-center rounded-full border-[3px] border-white font-extrabold text-ocean first:ms-0 ${avatarTones[i]}`}
            >
              {learnerNames(l, locale).primary.slice(0, 1)}
            </span>
          ))}
          {extra > 0 && (
            <span
              aria-hidden="true"
              className="-ms-2.5 grid size-10 place-items-center rounded-full border-[3px] border-white bg-mist text-sm font-extrabold text-brand"
            >
              {t("moreLearners", { count: formatNumber(extra, locale) })}
            </span>
          )}
        </div>
      )}
      <Link
        href={`/admin/classes/${next.classId}`}
        className="inline-flex min-h-13 items-center gap-2 rounded-pill bg-ocean px-6 font-extrabold text-white hover:bg-deep"
      >
        <Play aria-hidden size={18} weight="fill" className="icon-directional" />
        {t("goToClass")}
      </Link>
    </section>
  );
}

type Item = {
  key: string;
  at: Date;
  href: string;
  title: string;
  sub: string;
  badge: string;
  tone: string;
  highlight: boolean;
};

/** Today in one list: class sessions and booked free sessions, by time. */
export async function TodayTimeline({
  sessions,
  freeSessions,
}: {
  sessions: DaySession[];
  freeSessions: (UpcomingSlot & { lead: NonNullable<UpcomingSlot["lead"]> })[];
}) {
  const [t, tc, levels, locale] = await Promise.all([
    getTranslations("Admin.home"),
    getTranslations("Admin.classes"),
    getTranslations("Landing.booking.levels"),
    getLocale() as Promise<Locale>,
  ]);
  const nextId = sessions.find((s) => s.phase === "upcoming")?.id;
  const items: Item[] = [
    ...sessions.map((s) => {
      const [badge, tone] =
        s.phase === "live"
          ? [t("badgeLive"), "bg-ocean text-white"]
          : s.phase === "ended"
            ? [t("badgeToMark"), "bg-[#fcefd3] text-[#8a520e]"]
            : s.phase === "held"
              ? [t("badgeHeld"), "bg-[#ddf5e8] text-[#14613a]"]
              : s.phase === "cancelled"
                ? [t("badgeCancelled"), "bg-[#edf0f3] text-[#4a5866]"]
                : s.id === nextId
                  ? [t("badgeNext"), "bg-sand text-ocean"]
                  : [tc("detail.phase.upcoming"), "bg-surface text-body"];
      return {
        key: s.id,
        at: s.startsAt,
        href: `/admin/classes/${s.classId}`,
        title: `${classTitle(s, locale)} · ${s.level}`,
        sub:
          s.kind === "makeup"
            ? t("makeupSub", { count: s.people })
            : t("classSub", { type: tc(`type.${s.type}`), count: s.people }),
        badge,
        tone,
        highlight: s.phase === "live" || s.id === nextId,
      };
    }),
    ...freeSessions.map((f) => ({
      key: f.id,
      at: f.startsAt,
      href: "/admin/schedule",
      title: t("freeLine", { name: f.lead.name }),
      sub: t("freeSub", { level: levels(f.lead.levelGuess) }),
      badge: t("badgeFree"),
      tone: "bg-mist text-brand",
      highlight: false,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <section aria-labelledby="today-title" className={`${card} space-y-4 p-6`}>
      <h2 id="today-title" className="font-sans text-lg font-black normal-case tracking-normal">
        {t("todayTitle")}
      </h2>
      {items.length === 0 ? (
        <p>{t("todayEmpty")}</p>
      ) : (
        <ol className="space-y-1">
          {items.map((i) => (
            <li key={i.key}>
              <Link
                href={i.href}
                className={`flex items-center gap-3.5 rounded-2xl p-2.5 hover:bg-surface ${i.highlight ? "bg-[#ebf1f7]" : ""}`}
              >
                <span dir="ltr" className="min-w-13 text-xl font-bold text-brand">
                  {formatTime(i.at, locale)}
                </span>
                <span className="min-w-0 flex-1 leading-normal">
                  <b className="block truncate text-ocean">{i.title}</b>
                  <span className="text-sm">{i.sub}</span>
                </span>
                <span
                  className={`shrink-0 rounded-pill px-2.5 py-0.5 text-xs font-extrabold ${i.tone}`}
                >
                  {i.badge}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/**
 * Sessions that ended without being marked held (any day), as a list card in the dashboard's
 * third column (where the homework queue goes in M8). Each opens its class to take attendance.
 */
export async function AwaitingConfirmation({ sessions }: { sessions: DaySession[] }) {
  if (sessions.length === 0) return null;
  const [t, locale] = await Promise.all([
    getTranslations("Admin.home"),
    getLocale() as Promise<Locale>,
  ]);
  return (
    <section aria-labelledby="awaiting" className={`${card} space-y-4 p-6`}>
      <div>
        <h2 id="awaiting" className="font-sans text-lg font-black normal-case tracking-normal">
          {t("pendingTitle")}
        </h2>
        <p className="text-sm">{t("pendingHint")}</p>
      </div>
      <ul className="space-y-2.5">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={`/admin/classes/${s.classId}`}
              className="flex items-center gap-3 rounded-2xl bg-[#ebf1f7] p-3 hover:bg-mist"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white text-[#9a5b10]">
                <ClipboardText aria-hidden size={20} />
              </span>
              <span className="min-w-0 flex-1 leading-normal">
                <b className="block truncate text-ocean">{classTitle(s, locale)}</b>
                <span className="text-sm">
                  {formatDate(s.startsAt, locale, { year: false })} ·{" "}
                  {formatTime(s.startsAt, locale)}
                </span>
              </span>
              <span className="shrink-0 text-sm font-extrabold text-brand">{t("markHeld")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
